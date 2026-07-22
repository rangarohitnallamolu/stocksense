const pool = require('../shared/db');
const { PAPER_TRADING } = require('../shared/config');

async function execute(signal, riskResult, pipelineRunId) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    // 1. Save signal to DB
    const sigRes = await db.query(
      `INSERT INTO trade_signals
         (pipeline_run_id, ticker, action, confidence, entry_price,
          stop_loss_pct, take_profit_pct, stop_loss_price, take_profit_price,
          bull_thesis, bear_thesis, judge_reasoning, news_summary, risk_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'approved')
       RETURNING id`,
      [
        pipelineRunId, signal.ticker, signal.action, signal.confidence, signal.entry_price,
        riskResult.stopLossPct, riskResult.takeProfitPct,
        riskResult.stopLossPrice, riskResult.takeProfitPrice,
        signal.bull_thesis, signal.bear_thesis, signal.judge_reasoning, signal.news_summary,
      ]
    );
    const signalId = sigRes.rows[0].id;

    // 2. Open position record
    const posRes = await db.query(
      `INSERT INTO open_positions
         (ticker, action, entry_price, shares, trade_amount,
          stop_loss_price, take_profit_price, stop_loss_pct, take_profit_pct,
          signal_id, paper_trade)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        signal.ticker, signal.action, signal.entry_price,
        riskResult.shares, riskResult.tradeAmount,
        riskResult.stopLossPrice, riskResult.takeProfitPrice,
        riskResult.stopLossPct, riskResult.takeProfitPct,
        signalId, PAPER_TRADING,
      ]
    );
    const positionId = posRes.rows[0].id;

    // 3. Paper trade log
    await db.query(
      `INSERT INTO paper_trades (ticker, action, shares, price, total_amount, signal_id, position_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        signal.ticker,
        signal.action === 'BUY' ? 'BUY' : 'SHORT',
        riskResult.shares,
        signal.entry_price,
        riskResult.tradeAmount,
        signalId,
        positionId,
      ]
    );

    await db.query('COMMIT');

    // 4. Robinhood paper trade (wire up credentials when ready)
    if (!PAPER_TRADING) {
      await placeRobinhoodOrder(signal, riskResult, positionId);
    }

    console.log(`[EXEC] ${signal.action} ${riskResult.shares.toFixed(2)} × ${signal.ticker} @ $${signal.entry_price} | SL $${riskResult.stopLossPrice.toFixed(2)} TP $${riskResult.takeProfitPrice.toFixed(2)}`);
    return { success: true, signalId, positionId };

  } catch (e) {
    await db.query('ROLLBACK');
    console.error(`[EXEC] Failed for ${signal.ticker}:`, e.message);
    return { success: false, error: e.message };
  } finally {
    db.release();
  }
}

async function logRejectedSignal(signal, rejectReason, pipelineRunId) {
  const db = await pool.connect();
  try {
    await db.query(
      `INSERT INTO trade_signals
         (pipeline_run_id, ticker, action, confidence, entry_price,
          stop_loss_pct, take_profit_pct, stop_loss_price, take_profit_price,
          bull_thesis, bear_thesis, judge_reasoning, news_summary, risk_status, reject_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'rejected',$14)`,
      [
        pipelineRunId, signal.ticker, signal.action, signal.confidence, signal.entry_price,
        signal.stop_loss_pct, signal.take_profit_pct,
        signal.stop_loss_price, signal.take_profit_price,
        signal.bull_thesis, signal.bear_thesis, signal.judge_reasoning, signal.news_summary,
        rejectReason,
      ]
    );
  } finally {
    db.release();
  }
}

// Stub — wire up Robinhood API credentials and replace this
async function placeRobinhoodOrder(signal, riskResult, positionId) {
  // TODO: Implement Robinhood API integration
  // POST https://api.robinhood.com/orders/
  console.log('[ROBINHOOD] Order placement not yet configured. Running DB-only paper trade.');
}

module.exports = { execute, logRejectedSignal };
