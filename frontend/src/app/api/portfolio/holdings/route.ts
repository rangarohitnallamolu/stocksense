import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/api';

interface Holding {
  ticker:       string;
  total_shares: number;
  avg_cost:     number;
  total_invested: number;
  current_price: number;
  current_value: number;
  gain:         number;
  gain_pct:     number;
  day_change:   number;
  day_change_pct: number;
}

async function fetchQuote(ticker: string, key: string) {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`,
      { next: { revalidate: 30 } }
    );
    const d = await r.json();
    return { price: d.c ?? 0, change: d.d ?? 0, changePct: d.dp ?? 0 };
  } catch { return { price: 0, change: 0, changePct: 0 }; }
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Aggregate transactions into positions
  const posRes = await pool.query<{
    ticker: string;
    total_shares: string;
    total_buy_shares: string;
    total_buy_cost: string;
  }>(
    `SELECT
       ticker,
       SUM(CASE WHEN type='buy' THEN shares ELSE -shares END) AS total_shares,
       SUM(CASE WHEN type='buy' THEN shares ELSE 0 END)        AS total_buy_shares,
       SUM(CASE WHEN type='buy' THEN shares * price ELSE 0 END) AS total_buy_cost
     FROM transactions
     WHERE user_id = $1
     GROUP BY ticker
     HAVING SUM(CASE WHEN type='buy' THEN shares ELSE -shares END) > 0.0001
     ORDER BY ticker`,
    [userId]
  );

  if (!posRes.rows.length) return NextResponse.json([]);

  const key = process.env.FINNHUB_API_KEY!;

  // Fetch all quotes in parallel
  const quotes = await Promise.all(
    posRes.rows.map(r => fetchQuote(r.ticker, key))
  );

  const holdings: Holding[] = posRes.rows.map((row, i) => {
    const totalShares   = Number(row.total_shares);
    const totalBuyShares = Number(row.total_buy_shares);
    const totalBuyCost  = Number(row.total_buy_cost);
    const avgCost       = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0;
    const totalInvested = totalShares * avgCost;
    const { price, change, changePct } = quotes[i];
    const currentValue  = totalShares * price;
    const gain          = currentValue - totalInvested;
    const gainPct       = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    return {
      ticker:         row.ticker,
      total_shares:   totalShares,
      avg_cost:       avgCost,
      total_invested: totalInvested,
      current_price:  price,
      current_value:  currentValue,
      gain,
      gain_pct:       gainPct,
      day_change:     change * totalShares,
      day_change_pct: changePct,
    };
  });

  return NextResponse.json(holdings);
}
