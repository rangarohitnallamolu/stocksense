import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [a1Runs, a2Runs, recentNews, recentChanges, tokenSummary] = await Promise.all([
      pool.query(`SELECT tickers_scanned, news_processed, catalysts_found, high_importance,
                         input_tokens, output_tokens, cost_usd, duration_ms, run_at
                  FROM agent1_runs ORDER BY run_at DESC LIMIT 10`),
      pool.query(`SELECT tickers_analyzed, recommendations_new, recommendations_changed,
                         emails_triggered, input_tokens, output_tokens, cost_usd, duration_ms, run_at
                  FROM agent2_runs ORDER BY run_at DESC LIMIT 10`),
      pool.query(`SELECT ticker, headline, sentiment, importance_score,
                         category, is_catalyst, ai_summary, analyzed_at
                  FROM news_analysis ORDER BY analyzed_at DESC LIMIT 20`),
      pool.query(`SELECT ticker, prev_recommendation, new_recommendation,
                         prev_confidence, new_confidence, emails_sent, changed_at
                  FROM recommendation_changes ORDER BY changed_at DESC LIMIT 10`),
      pool.query(`SELECT
                    agent,
                    SUM(input_tokens)  AS total_in,
                    SUM(output_tokens) AS total_out,
                    SUM(cost_usd)      AS total_cost,
                    COUNT(*)           AS calls
                  FROM token_usage_log
                  WHERE logged_at > NOW() - INTERVAL '24 hours'
                  GROUP BY agent`),
    ]);
    return NextResponse.json({
      agent1Runs:   a1Runs.rows,
      agent2Runs:   a2Runs.rows,
      recentNews:   recentNews.rows,
      recentChanges: recentChanges.rows,
      tokenSummary: tokenSummary.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
