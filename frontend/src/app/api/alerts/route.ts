import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest, ensureUserProfile } from '@/lib/api';

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [alerts, history] = await Promise.all([
    pool.query(
      `SELECT id, ticker, alert_type, threshold, is_active, created_at
       FROM alerts WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT id, ticker, message, email_sent, fired_at
       FROM alert_history WHERE user_id=$1 ORDER BY fired_at DESC LIMIT 20`,
      [userId]
    ),
  ]);

  return NextResponse.json({ alerts: alerts.rows, history: history.rows });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker, alert_type, threshold } = await req.json();
  if (!ticker || !alert_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await ensureUserProfile(pool, userId);

  const result = await pool.query(
    `INSERT INTO alerts (user_id, ticker, alert_type, threshold)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [userId, ticker.toUpperCase(), alert_type, threshold ?? null]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}
