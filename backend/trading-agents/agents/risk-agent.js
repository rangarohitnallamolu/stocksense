const pool = require('../shared/db');
const { MAX_OPEN_POSITIONS, MIN_CONFIDENCE, TRADE_AMOUNT, SWAP_CONFIDENCE_MARGIN } = require('../shared/config');

async function evaluate(signal) {
  const db = await pool.connect();
  try {
    // 1. Skip/Hold actions need no risk evaluation
    if (signal.action === 'SKIP' || signal.action === 'HOLD') {
      return { approved: false, reason: 'no_trade_action' };
    }

    // 2. Low confidence
    if (signal.confidence < MIN_CONFIDENCE) {
      return { approved: false, reason: 'low_confidence' };
    }

    // 3. Already holding this ticker
    const existing = await db.query(
      'SELECT id FROM open_positions WHERE ticker = $1', [signal.ticker]
    );
    if (existing.rows.length > 0) {
      return { approved: false, reason: 'already_in_position' };
    }

    // 4. Day trading rule — no same-day close+open on same ticker
    const today = new Date().toISOString().split('T')[0];
    const sameDay = await db.query(
      `SELECT id FROM closed_positions WHERE ticker = $1 AND DATE(closed_at) = $2`,
      [signal.ticker, today]
    );
    if (sameDay.rows.length > 0) {
      return { approved: false, reason: 'day_trade_prevention' };
    }

    // 5. Check open position count
    const openRes = await db.query(
      `SELECT ticker,
              entry_price,
              (SELECT price FROM trading_watchlist WHERE ticker = op.ticker) AS current_price,
              (SELECT confidence FROM trade_signals WHERE id = op.signal_id) AS signal_confidence
       FROM open_positions op`
    );
    const openPositions = openRes.rows;

    if (openPositions.length >= MAX_OPEN_POSITIONS) {
      // Check if this new signal is strong enough to warrant a swap
      const weakest = openPositions
        .map(p => ({
          ...p,
          pnl_pct: p.current_price
            ? ((p.current_price - p.entry_price) / p.entry_price) * 100
            : 0,
        }))
        .sort((a, b) => a.pnl_pct - b.pnl_pct)[0];

      const weakestConf = parseInt(weakest.signal_confidence || 0);
      const canSwap = signal.confidence >= weakestConf + SWAP_CONFIDENCE_MARGIN;

      return {
        approved: false,
        swapNeeded: canSwap,
        dropTicker: canSwap ? weakest.ticker : null,
        dropPnlPct: canSwap ? weakest.pnl_pct?.toFixed(2) : null,
        reason: canSwap ? 'swap_candidate' : 'max_positions_reached',
      };
    }

    // 6. Calculate position parameters
    const tradeAmount = TRADE_AMOUNT;
    const shares = tradeAmount / signal.entry_price;
    const slPct  = signal.stop_loss_pct;
    const tpPct  = signal.take_profit_pct;

    const stopLossPrice = signal.action === 'BUY'
      ? signal.entry_price * (1 - slPct / 100)
      : signal.entry_price * (1 + slPct / 100);

    const takeProfitPrice = signal.action === 'BUY'
      ? signal.entry_price * (1 + tpPct / 100)
      : signal.entry_price * (1 - tpPct / 100);

    return {
      approved: true,
      shares:           parseFloat(shares.toFixed(4)),
      tradeAmount,
      stopLossPrice:    parseFloat(stopLossPrice.toFixed(4)),
      takeProfitPrice:  parseFloat(takeProfitPrice.toFixed(4)),
      stopLossPct:      slPct,
      takeProfitPct:    tpPct,
    };
  } finally {
    db.release();
  }
}

module.exports = { evaluate };
