import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT op.*, ts.confidence, ts.bull_thesis, ts.judge_reasoning
      FROM open_positions op
      LEFT JOIN trade_signals ts ON ts.id = op.signal_id
      ORDER BY op.opened_at DESC
    `);

    const tickers = rows.map((r: { ticker: string }) => r.ticker);
    const prices: Record<string, number> = {};

    await Promise.allSettled(tickers.map(async (ticker: string) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
          { signal: AbortSignal.timeout(3000) }
        );
        const data = await res.json();
        prices[ticker] = data?.c || 0;
      } catch {
        prices[ticker] = 0;
      }
    }));

    const enriched = rows.map((pos: Record<string, unknown>) => {
      const entryPrice = Number(pos.entry_price);
      const shares = Number(pos.shares);
      const current = prices[pos.ticker as string] || entryPrice;
      const isBuy = pos.action === 'BUY';
      const pnl = isBuy
        ? (current - entryPrice) * shares
        : (entryPrice - current) * shares;
      const pnl_pct = isBuy
        ? ((current - entryPrice) / entryPrice) * 100
        : ((entryPrice - current) / entryPrice) * 100;

      return { ...pos, current_price: current, pnl: pnl.toFixed(2), pnl_pct: pnl_pct.toFixed(2) };
    });

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
}
