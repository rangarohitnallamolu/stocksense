require('dotenv').config({ path: require('path').join(__dirname, '../../frontend/.env.local') });

const cron = require('node-cron');
const pool = require('./shared/db');
const config = require('./shared/config');

const dataAgent      = require('./agents/data-agent');
const newsAgent      = require('./agents/news-agent');
const bullAgent      = require('./agents/bull-agent');
const bearAgent      = require('./agents/bear-agent');
const judgeAgent     = require('./agents/judge-agent');
const riskAgent      = require('./agents/risk-agent');
const executionAgent = require('./agents/execution-agent');
const monitorAgent   = require('./agents/monitor-agent');

function isMarketOpen() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 570 && mins <= 960;
}

async function setProgress(runId, pct, stage) {
  const db = await pool.connect();
  try {
    await db.query(
      `UPDATE pipeline_runs SET progress_pct=$1, progress_stage=$2 WHERE id=$3`,
      [pct, stage, runId]
    );
    console.log(`[PROGRESS] ${pct}% — ${stage}`);
  } finally {
    db.release();
  }
}

async function isWatchlistStale() {
  const db = await pool.connect();
  try {
    const r = await db.query(`SELECT MAX(last_updated) AS last FROM trading_watchlist WHERE active=true`);
    if (!r.rows[0].last) return true;
    return Date.now() - new Date(r.rows[0].last).getTime() > config.WATCHLIST_REFRESH_DAYS * 86400000;
  } finally {
    db.release();
  }
}

async function getWatchlist() {
  const db = await pool.connect();
  try {
    const r = await db.query(`SELECT ticker FROM trading_watchlist WHERE active=true ORDER BY beta DESC NULLS LAST`);
    return r.rows.map(r => r.ticker);
  } finally {
    db.release();
  }
}

async function runPipeline() {
  const start = Date.now();
  let runId = null;

  try {
    // ── 0% · Start ───────────────────────────────────────
    const db0 = await pool.connect();
    const runRes = await db0.query(
      `INSERT INTO pipeline_runs (status, progress_pct, progress_stage)
       VALUES ('running', 0, 'Initializing') RETURNING id`
    );
    runId = runRes.rows[0].id;
    db0.release();

    // ── 5% · Watchlist check ──────────────────────────────
    await setProgress(runId, 5, 'Checking watchlist');
    if (await isWatchlistStale()) {
      await setProgress(runId, 8, 'Refreshing watchlist');
      console.log('[ORCH] Watchlist stale — refreshing...');
      require('child_process').execSync('node scripts/refresh-watchlist.js', { cwd: __dirname, stdio: 'inherit' });
    }

    const tickers = await getWatchlist();
    console.log(`[ORCH] Loop started — ${tickers.length} tickers | ${new Date().toISOString()}`);

    // ── 10% · Fetch market data ───────────────────────────
    await setProgress(runId, 10, `Fetching market data (${tickers.length} tickers)`);
    const snapshots = await dataAgent.fetchAll(tickers);
    console.log(`[DATA] Got ${snapshots.length}/${tickers.length} snapshots`);

    // ── 30% · Score news ──────────────────────────────────
    await setProgress(runId, 30, 'Scoring news & sentiment');
    const newsScores = await newsAgent.scoreAll(snapshots);

    const highSignal = snapshots.filter(s =>
      newsScores[s.ticker]?.isHighSignal || Math.abs(s.change_pct || 0) > 2.5
    );
    console.log(`[NEWS] ${highSignal.length} high-signal tickers: ${highSignal.map(s => s.ticker).join(', ')}`);

    // ── 50% · Debate loop ─────────────────────────────────
    await setProgress(runId, 50, `Running debate on ${highSignal.length} tickers`);

    let signalsFound = 0;
    let tradesExecuted = 0;
    const total = highSignal.length || 1;

    for (let i = 0; i < highSignal.length; i++) {
      const snapshot = highSignal[i];
      // Progress moves from 50% → 85% across the debate loop
      const loopPct = 50 + Math.round(((i + 1) / total) * 35);
      await setProgress(runId, loopPct, `Analysing ${snapshot.ticker} (${i + 1}/${total})`);

      try {
        const newsData = newsScores[snapshot.ticker];

        const [bull, bear] = await Promise.all([
          bullAgent.analyze(snapshot, newsData),
          bearAgent.analyze(snapshot, newsData),
        ]);

        const signal = await judgeAgent.decide(bull, bear, newsData, snapshot);
        signalsFound++;
        console.log(`[JUDGE] ${snapshot.ticker}: ${signal.action} (${signal.confidence}%)`);

        if (signal.action === 'SKIP' || signal.action === 'HOLD') {
          await executionAgent.logRejectedSignal(signal, 'judge_skip', runId);
          continue;
        }

        const riskResult = await riskAgent.evaluate(signal);
        if (riskResult.approved) {
          const result = await executionAgent.execute(signal, riskResult, runId);
          if (result.success) tradesExecuted++;
        } else {
          await executionAgent.logRejectedSignal(signal, riskResult.reason, runId);
          if (riskResult.swapNeeded) {
            console.log(`[RISK] Swap: drop ${riskResult.dropTicker} for ${snapshot.ticker}`);
          }
        }
      } catch (e) {
        console.error(`[ORCH] Error on ${snapshot.ticker}:`, e.message);
      }
    }

    // ── 90% · Monitor positions ───────────────────────────
    await setProgress(runId, 90, 'Checking open positions');
    const exits = await monitorAgent.checkPositions();
    if (exits.length) {
      console.log(`[MONITOR] Closed: ${exits.map(e => `${e.ticker}(${e.reason})`).join(', ')}`);
    }

    // ── 100% · Done ───────────────────────────────────────
    const duration = Date.now() - start;
    const dbFinal = await pool.connect();
    await dbFinal.query(
      `UPDATE pipeline_runs
       SET status='completed', duration_ms=$1, tickers_scanned=$2,
           signals_found=$3, trades_executed=$4, progress_pct=100, progress_stage='Complete'
       WHERE id=$5`,
      [duration, snapshots.length, signalsFound, tradesExecuted, runId]
    );
    dbFinal.release();

    console.log(`[ORCH] Done in ${duration}ms | signals:${signalsFound} trades:${tradesExecuted} exits:${exits.length}`);

  } catch (e) {
    console.error('[ORCH] Pipeline error:', e.message);
    if (runId) {
      const dbErr = await pool.connect();
      await dbErr.query(
        `UPDATE pipeline_runs SET status='failed', error=$1, progress_stage='Failed' WHERE id=$2`,
        [e.message, runId]
      );
      dbErr.release();
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('[ORCH] Trading agent orchestrator starting...');
console.log(`[ORCH] Mode: ${config.PAPER_TRADING ? 'PAPER TRADING' : 'LIVE TRADING'}`);

if (isMarketOpen()) {
  console.log('[ORCH] Market open — running first pipeline immediately...');
  runPipeline();
} else {
  console.log('[ORCH] Market closed — waiting for market hours (9:30 AM–4:00 PM ET)');
}

cron.schedule('*/10 * * * *', () => {
  if (!isMarketOpen()) { console.log('[ORCH] Market closed — skipping'); return; }
  runPipeline();
});

cron.schedule('* * * * *', async () => {
  if (!isMarketOpen()) return;
  try {
    const exits = await monitorAgent.checkPositions();
    if (exits.length) console.log(`[MONITOR] Emergency exits: ${exits.map(e => `${e.ticker}(${e.reason})`).join(', ')}`);
  } catch (e) { console.error('[MONITOR]', e.message); }
});

// node-cron 3.x unrefs its timers — this keeps the process alive between ticks
setInterval(() => {}, 1 << 30);
