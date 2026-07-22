const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('pg');
const axios = require('axios');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sm = new SecretsManagerClient({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });

const SONNET_IN  = 3.00  / 1_000_000;
const SONNET_OUT = 15.00 / 1_000_000;
const BATCH_SIZE = 5; // analyze 5 tickers per Claude call

async function getSecret(n) {
  return (await sm.send(new GetSecretValueCommand({ SecretId: n }))).SecretString;
}

async function getDb(creds) {
  const c = JSON.parse(creds);
  const db = new Client({ host:c.host, port:c.port, user:c.username, password:c.password, database:c.dbname, ssl:{rejectUnauthorized:false} });
  await db.connect();
  return db;
}

async function fetchFinnhub(ticker, key) {
  const b = 'https://finnhub.io/api/v1';
  const t = `token=${key}`;
  const [profile, quote, metrics] = await Promise.all([
    axios.get(`${b}/stock/profile2?symbol=${ticker}&${t}`, { timeout: 4000 }).then(r => r.data).catch(() => ({})),
    axios.get(`${b}/quote?symbol=${ticker}&${t}`, { timeout: 4000 }).then(r => r.data).catch(() => ({})),
    axios.get(`${b}/stock/metric?symbol=${ticker}&metric=all&${t}`, { timeout: 4000 }).then(r => r.data?.metric || {}).catch(() => ({})),
  ]);
  return { profile, quote, metrics };
}

async function getAgent1Data(db, ticker) {
  const r = await db.query(
    `SELECT sentiment, importance_score, is_catalyst, catalyst_type, catalyst_value, ai_summary
     FROM news_analysis WHERE ticker=$1 ORDER BY analyzed_at DESC LIMIT 2`, [ticker]
  );
  return r.rows;
}

async function getPrevReco(db, ticker) {
  const r = await db.query(
    `SELECT recommendation, confidence_score FROM recommendations WHERE ticker=$1 ORDER BY generated_at DESC LIMIT 1`,
    [ticker]
  );
  return r.rows[0] || null;
}

// Build one line of data per ticker — ultra compressed
function tickerLine(item) {
  const { ticker, price, profile, metrics, a1News } = item;
  const pe   = (metrics.peNormalizedAnnual || metrics.peTTM || '?');
  const roe  = metrics.roeAnnual?.toFixed(0) || '?';
  const ret  = metrics['52WeekPriceReturnDaily']?.toFixed(0) || '?';
  const beta = metrics.beta?.toFixed(1) || '?';
  const news = a1News.length
    ? a1News.map(n => `${n.sentiment[0]}${n.importance_score}${n.is_catalyst?'⚡':''} ${(n.ai_summary||'').slice(0,50)}`).join(' / ')
    : 'no news';
  const cats = a1News.filter(n => n.is_catalyst).map(n => `${n.catalyst_type}:$${n.catalyst_value?(n.catalyst_value/1e6).toFixed(0)+'M':'?'}`).join(',') || 'none';
  const name = (profile.name || ticker).slice(0, 20);
  return `${ticker}(${name}) $${price} PE:${pe} ROE:${roe}% β:${beta} 52wR:${ret}% | ${news} | cats:${cats}`;
}

// ── BATCH PROMPT: ~40 token header + ~60 per ticker (was 320 per ticker) ──
function buildBatchPrompt(batch) {
  const lines = batch.map((item, i) => `${i+1}. ${tickerLine(item)}`).join('\n');
  return `Rate ${batch.length} stocks. Weights: analyst25% news20% financial25% catalyst30%(contracts=highest).
${lines}
JSON array[${batch.length}] one obj each:{"r":"STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL","c":0-100,"t":target,"u":upside_pct,"reason":"1 sentence","ac":0-100,"ns":0-100,"fh":0-100,"gc":0-100,"cats":["c1"],"risks":["r1"]}`;
}

async function batchAnalyze(claude, batch, db) {
  const prompt = buildBatchPrompt(batch);

  const msg = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: batch.length * 120, // ~120 tokens per ticker response
    messages: [{ role: 'user', content: prompt }],
  });

  const u = msg.usage;
  const cost = (u.input_tokens * SONNET_IN) + (u.output_tokens * SONNET_OUT);

  // Log one entry for the whole batch
  await db.query(
    `INSERT INTO token_usage_log (agent,ticker,model,input_tokens,output_tokens,cost_usd) VALUES ($1,$2,$3,$4,$5,$6)`,
    ['agent2', `batch:${batch.map(b=>b.ticker).join(',')}`, 'claude-sonnet-4-6', u.input_tokens, u.output_tokens, cost]
  );

  try {
    const text = msg.content[0].text.trim();
    const raw = JSON.parse(text.startsWith('`') ? text.replace(/```json?\n?/g,'').replace(/```/g,'') : text);
    const arr = Array.isArray(raw) ? raw : [raw];
    return {
      results: arr.map(r => ({
        recommendation:  r.r,
        confidence_score: r.c,
        price_target_12m: r.t,
        upside_pct:       r.u,
        reasoning:        r.reason,
        score_breakdown:  { analyst_consensus:{score:r.ac,detail:''}, news_sentiment:{score:r.ns,detail:''}, financial_health:{score:r.fh,detail:''}, growth_catalysts:{score:r.gc,detail:''} },
        key_catalysts: r.cats || [],
        key_risks:     r.risks || [],
      })),
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cost_usd: cost,
    };
  } catch { return { results: [], input_tokens: u.input_tokens, output_tokens: u.output_tokens, cost_usd: cost }; }
}

// Decide if this stock needs Claude at all
function needsAnalysis(a1News, prevReco) {
  // Always analyze if catalyst or high importance
  if (a1News.some(n => n.is_catalyst || n.importance_score >= 6)) return true;
  // Always analyze if no previous recommendation
  if (!prevReco) return true;
  // Skip if previous was HOLD and no meaningful news
  if (prevReco.recommendation === 'HOLD' && !a1News.length) return false;
  // Skip if previous high-confidence reco and no news
  if (prevReco.confidence_score >= 70 && !a1News.length) return false;
  return true;
}

async function sendChangeEmail(db, ticker, prev, reco, name, sender) {
  const users = await db.query(
    `SELECT DISTINCT up.email FROM user_profiles up WHERE up.notify_ai_reco=true AND (
       EXISTS(SELECT 1 FROM watchlist w WHERE w.user_id=up.user_id AND w.ticker=$1)
       OR EXISTS(SELECT 1 FROM transactions t WHERE t.user_id=up.user_id AND t.ticker=$1))`, [ticker]
  );
  if (!users.rows.length) return 0;
  const emoji = {STRONG_BUY:'🟢🟢',BUY:'🟢',HOLD:'🟡',SELL:'🔴',STRONG_SELL:'🔴🔴'};
  const subj = `AI Alert: ${ticker} → ${reco.recommendation} (${reco.confidence_score}% confidence)`;
  const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;background:#0a0a0a;color:#fff;padding:28px;border-radius:14px;">
<div style="background:#22c55e;display:inline-block;padding:5px 12px;border-radius:7px;font-weight:700;margin-bottom:20px;">StockApp AI</div>
<h2>${ticker} — ${emoji[reco.recommendation]} ${reco.recommendation}</h2>
<p style="color:#9ca3af;">${name} · was ${prev?.recommendation||'—'} → now ${reco.confidence_score}% confident</p>
<div style="background:#111;border-radius:10px;padding:16px;margin-bottom:14px;"><p style="margin:0;color:#e5e7eb;">${reco.reasoning}</p></div>
<div style="background:#111;border-radius:10px;padding:16px;margin-bottom:18px;">
  <div style="color:#9ca3af;font-size:11px;">12-MONTH TARGET</div>
  <div style="font-size:26px;font-weight:700;color:#22c55e;">$${reco.price_target_12m}</div>
  <div style="color:#9ca3af;">${reco.upside_pct>0?'+':''}${Number(reco.upside_pct).toFixed(1)}% upside</div>
</div>
<p style="color:#4b5563;font-size:10px;text-align:center;">AI-generated · not financial advice</p></div>`;
  let sent = 0;
  for (const u of users.rows) {
    try {
      await ses.send(new SendEmailCommand({ Source:sender, Destination:{ToAddresses:[u.email]}, Message:{Subject:{Data:subj},Body:{Html:{Data:html}}} }));
      sent++;
    } catch {}
  }
  return sent;
}

async function getTickers(db, triggered) {
  if (triggered?.length) return triggered;
  const r = await db.query(`SELECT DISTINCT ticker FROM (
    SELECT ticker FROM watchlist
    UNION SELECT ticker FROM transactions
    UNION SELECT ticker FROM sp500_tickers WHERE active=true LIMIT 100) t`);
  return r.rows.map(r => r.ticker);
}

exports.handler = async (event) => {
  const start = Date.now();
  const [fhKey, anthropicKey, dbCreds] = await Promise.all([
    getSecret('stockapp/finnhub/api-key'),
    getSecret('stockapp/anthropic/api-key'),
    getSecret('stockapp/rds/credentials'),
  ]);

  const db = await getDb(dbCreds);
  const claude = new Anthropic({ apiKey: anthropicKey });
  const allTickers = await getTickers(db, event?.tickers);

  let recoNew = 0, recoChanged = 0, emails = 0, skipped = 0;
  let totalIn = 0, totalOut = 0, totalCost = 0;

  // Gather data for all tickers
  const enriched = [];
  for (const ticker of allTickers) {
    try {
      const [fhData, a1News, prevReco] = await Promise.all([
        fetchFinnhub(ticker, fhKey),
        getAgent1Data(db, ticker),
        getPrevReco(db, ticker),
      ]);
      const price = fhData.quote?.c;
      if (!price || price === 0) continue;

      if (!needsAnalysis(a1News, prevReco)) {
        skipped++;
        continue;
      }

      enriched.push({ ticker, price, profile: fhData.profile, metrics: fhData.metrics, a1News, prevReco });
    } catch (e) { console.error(`${ticker} fetch:`, e.message); }
  }

  console.log(`Analyzing ${enriched.length} tickers, skipped ${skipped} (no new signal)`);

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    try {
      const { results, input_tokens, output_tokens, cost_usd } = await batchAnalyze(claude, batch, db);
      totalIn   += input_tokens;
      totalOut  += output_tokens;
      totalCost += cost_usd;

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const reco = results[j];
        if (!reco?.recommendation) continue;

        const ins = await db.query(
          `INSERT INTO recommendations (ticker,recommendation,confidence_score,price_at_analysis,price_target_12m,upside_pct,reasoning,score_breakdown,key_catalysts,key_risks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [item.ticker, reco.recommendation, reco.confidence_score, item.price,
           reco.price_target_12m, reco.upside_pct, reco.reasoning,
           JSON.stringify(reco.score_breakdown), JSON.stringify(reco.key_catalysts), JSON.stringify(reco.key_risks)]
        );
        recoNew++;

        await db.query(
          `INSERT INTO recommendation_outcomes (recommendation_id,ticker,recommendation,price_at_reco,price_target) VALUES ($1,$2,$3,$4,$5)`,
          [ins.rows[0].id, item.ticker, reco.recommendation, item.price, reco.price_target_12m]
        );

        if (item.prevReco && item.prevReco.recommendation !== reco.recommendation) {
          recoChanged++;
          await db.query(
            `INSERT INTO recommendation_changes (ticker,prev_recommendation,new_recommendation,prev_confidence,new_confidence,change_reason) VALUES ($1,$2,$3,$4,$5,$6)`,
            [item.ticker, item.prevReco.recommendation, reco.recommendation, item.prevReco.confidence_score, reco.confidence_score, reco.reasoning.slice(0,200)]
          );
          const sent = await sendChangeEmail(db, item.ticker, item.prevReco, reco, item.profile?.name||item.ticker, 'rangarohit.nallamolu@gmail.com');
          emails += sent;
        }
      }
    } catch (e) { console.error(`Batch ${i}-${i+BATCH_SIZE} error:`, e.message); }
  }

  const duration = Date.now() - start;
  const batchCalls = Math.ceil(enriched.length / BATCH_SIZE);
  await db.query(
    `INSERT INTO agent2_runs (tickers_analyzed,recommendations_new,recommendations_changed,emails_triggered,duration_ms,input_tokens,output_tokens,cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [allTickers.length, recoNew, recoChanged, emails, duration, totalIn, totalOut, totalCost]
  );

  await db.end();
  console.log(`Agent2 done ${duration}ms | tickers:${allTickers.length} analyzed:${enriched.length} skipped:${skipped} batches:${batchCalls} | in:${totalIn} out:${totalOut} cost:$${totalCost.toFixed(4)}`);
  return { tickers: allTickers.length, analyzed: enriched.length, skipped, batchCalls, totalIn, totalOut, totalCost };
};
