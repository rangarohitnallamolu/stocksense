import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '30');

  try {
    const { rows } = await pool.query(`
      SELECT ts.*, pr.run_at
      FROM trade_signals ts
      LEFT JOIN pipeline_runs pr ON pr.id = ts.pipeline_run_id
      ORDER BY ts.created_at DESC
      LIMIT $1
    `, [limit]);

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
