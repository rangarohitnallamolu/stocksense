import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest, ensureUserProfile } from '@/lib/api';

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get('ticker');
  const query  = ticker
    ? `SELECT * FROM transactions WHERE user_id=$1 AND ticker=$2 ORDER BY trade_date DESC, created_at DESC`
    : `SELECT * FROM transactions WHERE user_id=$1 ORDER BY trade_date DESC, created_at DESC`;
  const params = ticker ? [userId, ticker.toUpperCase()] : [userId];

  const result = await pool.query(query, params);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker, type, shares, price, trade_date, notes } = await req.json();
  if (!ticker || !type || !shares || !price || !trade_date)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  await ensureUserProfile(pool, userId);

  const result = await pool.query(
    `INSERT INTO transactions (user_id, ticker, type, shares, price, trade_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, ticker.toUpperCase(), type, Number(shares), Number(price), trade_date, notes ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
