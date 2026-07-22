import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (ticker)
        ticker, recommendation, confidence_score,
        price_at_analysis, price_target_12m, upside_pct,
        reasoning, score_breakdown, key_catalysts, key_risks,
        generated_at
      FROM recommendations
      ORDER BY ticker, generated_at DESC
      LIMIT 20
    `);
    return NextResponse.json(result.rows);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
