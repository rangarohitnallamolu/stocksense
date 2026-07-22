const pool = require('../shared/db');
const { fetchSnapshot } = require('./data-agent');

async function checkPositions() {
  const db = await pool.connect();
  const exits = [];

  try {
    const { rows: positions } = await db.query('SELECT * FROM open_positions');
    if (!positions.length) return exits;

    await Promise.all(positions.map(async (pos) => {
      try {
        const snap = await fetchSnapshot(pos.ticker);
        if (!snap) return;

        const price = snap.price;
        const today = new Date().toISOString().split('T')[0];
        const openDate = new Date(pos.session_date).toISOString().split('T')[0];
        const isSameSession = openDate === today;

        let shouldExit = false;
        let exitReason = null;

        const isBuy = pos.action === 'BUY';

        // Stop-loss check (emergency — overrides day-trade prevention)
        if (isBuy && price <= pos.stop_loss_price) {
          shouldExit = true;
          exitReason = isSameSession ? 'emergency' : 'stop_loss';
        } else if (!isBuy && price >= pos.stop_loss_price) {
          shouldExit = true;
          exitReason = isSameSession ? 'emergency' : 'stop_loss';
        }

        // Take-profit check (respects session rule — won't exit same session unless also triggered by stop)
        if (!shouldExit && !isSameSession) {
          if (isBuy && price >= pos.take_profit_price) {
            shouldExit = true;
            exitReason = 'take_profit';
          } else if (!isBuy && price <= pos.take_profit_price) {
            shouldExit = true;
            exitReason = 'take_profit';
          }
        }

        if (shouldExit) {
          await closePosition(db, pos, price, exitReason);
          exits.push({ ticker: pos.ticker, reason: exitReason, exitPrice: price });
          console.log(`[MONITOR] Closing ${pos.ticker} @ $${price} — ${exitReason}`);
        } else {
          // Update last_price in watchlist for dashboard
          await db.query(
            'UPDATE trading_watchlist SET last_price = $1 WHERE ticker = $2',
            [price, pos.ticker]
          );
        }
      } catch (e) {
        console.error(`[MONITOR] Error checking ${pos.ticker}:`, e.message);
      }
    }));
  } finally {
    db.release();
  }

  return exits;
}

async function closePosition(db, pos, exitPrice, exitReason) {
  const isBuy = pos.action === 'BUY';
  const pnl = isBuy
    ? (exitPrice - pos.entry_price) * pos.shares
    : (pos.entry_price - exitPrice) * pos.shares;
  const pnlPct = isBuy
    ? ((exitPrice - pos.entry_price) / pos.entry_price) * 100
    : ((pos.entry_price - exitPrice) / pos.entry_price) * 100;

  const openedAt = new Date(pos.opened_at);
  const now = new Date();
  const msPerDay = 86400000;
  const sessionsHeld = Math.floor((now - openedAt) / msPerDay);

  await db.query('BEGIN');

  const closeRes = await db.query(
    `INSERT INTO closed_positions
       (open_position_id, ticker, action, entry_price, exit_price, shares,
        trade_amount, pnl, pnl_pct, exit_reason, opened_at, sessions_held, paper_trade)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      pos.id, pos.ticker, pos.action, pos.entry_price, exitPrice, pos.shares,
      pos.trade_amount, pnl.toFixed(2), pnlPct.toFixed(4),
      exitReason, pos.opened_at, sessionsHeld, pos.paper_trade,
    ]
  );

  const closedId = closeRes.rows[0].id;

  // Paper trade exit log
  await db.query(
    `INSERT INTO paper_trades (ticker, action, shares, price, total_amount, position_id, source)
     VALUES ($1,$2,$3,$4,$5,$6,'auto')`,
    [
      pos.ticker,
      pos.action === 'BUY' ? 'SELL' : 'COVER',
      pos.shares,
      exitPrice,
      (exitPrice * pos.shares).toFixed(2),
      pos.id,
    ]
  );

  // Accuracy tracker
  const wasCorrect = pnlPct > 0;
  await db.query(
    `INSERT INTO accuracy_tracker
       (signal_id, closed_position_id, ticker, action,
        predicted_tp_pct, actual_return_pct,
        hit_take_profit, hit_stop_loss, was_correct, signal_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      pos.signal_id, closedId, pos.ticker, pos.action,
      pos.take_profit_pct, pnlPct.toFixed(4),
      exitReason === 'take_profit', exitReason === 'stop_loss' || exitReason === 'emergency',
      wasCorrect, pos.opened_at,
    ]
  );

  await db.query('DELETE FROM open_positions WHERE id = $1', [pos.id]);
  await db.query('COMMIT');
}

module.exports = { checkPositions };
