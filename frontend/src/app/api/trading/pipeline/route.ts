import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM pipeline_runs
      ORDER BY run_at DESC
      LIMIT 10
    `);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch pipeline runs' }, { status: 500 });
  }
}
