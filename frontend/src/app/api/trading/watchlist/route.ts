import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT tw.*,
        (SELECT COUNT(*) FROM trade_signals ts WHERE ts.ticker = tw.ticker) AS total_signals,
        (SELECT COUNT(*) FROM open_positions op WHERE op.ticker = tw.ticker) AS in_position
      FROM trading_watchlist tw
      WHERE tw.active = true
      ORDER BY tw.beta DESC NULLS LAST
    `);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}
