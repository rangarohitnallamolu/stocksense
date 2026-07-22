import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [a1, a2] = await Promise.all([
      pool.query('SELECT tickers_scanned, news_processed, catalysts_found, high_importance, run_at, duration_ms FROM agent1_runs ORDER BY run_at DESC LIMIT 1'),
      pool.query('SELECT tickers_analyzed, recommendations_new, recommendations_changed, emails_triggered, run_at, duration_ms FROM agent2_runs ORDER BY run_at DESC LIMIT 1'),
    ]);
    return NextResponse.json({
      agent1: a1.rows[0] || null,
      agent2: a2.rows[0] || null,
    });
  } catch {
    return NextResponse.json({ agent1: null, agent2: null });
  }
}
