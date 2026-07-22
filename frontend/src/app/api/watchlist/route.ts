import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest, ensureUserProfile } from '@/lib/api';

async function fetchQuote(ticker: string, key: string) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`,
      { next: { revalidate: 30 } });
    const d = await r.json();
    return { price: d.c ?? 0, change: d.d ?? 0, changePct: d.dp ?? 0, high: d.h ?? 0, low: d.l ?? 0, prevClose: d.pc ?? 0 };
  } catch { return { price: 0, change: 0, changePct: 0, high: 0, low: 0, prevClose: 0 }; }
}

// GET — list watchlist with live prices
export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const check = req.nextUrl.searchParams.get('check');

  // Check if specific ticker is watched
  if (check) {
    const r = await pool.query(
      'SELECT id FROM watchlist WHERE user_id=$1 AND ticker=$2', [userId, check.toUpperCase()]
    );
    return NextResponse.json({ watching: r.rowCount! > 0 });
  }

  const res = await pool.query(
    'SELECT ticker, added_at FROM watchlist WHERE user_id=$1 ORDER BY added_at DESC', [userId]
  );
  if (!res.rows.length) return NextResponse.json([]);

  const key    = process.env.FINNHUB_API_KEY!;
  const quotes = await Promise.all(res.rows.map(r => fetchQuote(r.ticker, key)));

  return NextResponse.json(
    res.rows.map((row, i) => ({ ticker: row.ticker, added_at: row.added_at, ...quotes[i] }))
  );
}

// POST — add to watchlist
export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await req.json();
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

  await ensureUserProfile(pool, userId);
  await pool.query(
    'INSERT INTO watchlist (user_id, ticker) VALUES ($1,$2) ON CONFLICT (user_id,ticker) DO NOTHING',
    [userId, ticker.toUpperCase()]
  );
  return NextResponse.json({ watching: true });
}
