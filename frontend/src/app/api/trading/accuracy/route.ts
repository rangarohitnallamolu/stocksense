import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [overall, byTicker, recent] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                          AS total_trades,
          SUM(CASE WHEN was_correct THEN 1 ELSE 0 END)     AS wins,
          SUM(CASE WHEN NOT was_correct THEN 1 ELSE 0 END) AS losses,
          SUM(CASE WHEN hit_take_profit THEN 1 ELSE 0 END) AS take_profits_hit,
          SUM(CASE WHEN hit_stop_loss THEN 1 ELSE 0 END)   AS stop_losses_hit,
          ROUND(AVG(actual_return_pct)::numeric, 2)         AS avg_return_pct,
          ROUND(
            100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),
            1
          )                                                 AS win_rate_pct
        FROM accuracy_tracker
      `),
      pool.query(`
        SELECT ticker, COUNT(*) AS trades,
          ROUND(100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / COUNT(*), 1) AS win_rate,
          ROUND(AVG(actual_return_pct)::numeric, 2) AS avg_return
        FROM accuracy_tracker
        GROUP BY ticker
        ORDER BY trades DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT ticker, action, predicted_tp_pct, actual_return_pct,
               hit_take_profit, hit_stop_loss, was_correct, evaluated_at
        FROM accuracy_tracker
        ORDER BY evaluated_at DESC
        LIMIT 10
      `),
    ]);

    return NextResponse.json({
      overall: overall.rows[0],
      byTicker: byTicker.rows,
      recent: recent.rows,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accuracy' }, { status: 500 });
  }
}
