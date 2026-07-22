import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const SETUP_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at           TIMESTAMP DEFAULT NOW(),
  duration_ms      INTEGER,
  tickers_scanned  INTEGER DEFAULT 0,
  signals_found    INTEGER DEFAULT 0,
  trades_executed  INTEGER DEFAULT 0,
  status           VARCHAR(20) DEFAULT 'running',
  progress_pct     INTEGER DEFAULT 0,
  progress_stage   VARCHAR(80) DEFAULT 'Initializing',
  error            TEXT
);

ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS progress_pct   INTEGER DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(80) DEFAULT 'Initializing';

CREATE TABLE IF NOT EXISTS trading_watchlist (
  ticker         VARCHAR(10) PRIMARY KEY,
  name           VARCHAR(200),
  sector         VARCHAR(100),
  beta           DECIMAL(8,4),
  volatility_30d DECIMAL(8,4),
  last_price     DECIMAL(12,4),
  last_updated   TIMESTAMP DEFAULT NOW(),
  active         BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS trade_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id   UUID,
  ticker            VARCHAR(10),
  action            VARCHAR(10),
  confidence        INTEGER,
  entry_price       DECIMAL(12,4),
  stop_loss_pct     DECIMAL(6,4),
  take_profit_pct   DECIMAL(6,4),
  stop_loss_price   DECIMAL(12,4),
  take_profit_price DECIMAL(12,4),
  bull_thesis       TEXT,
  bear_thesis       TEXT,
  judge_reasoning   TEXT,
  news_summary      TEXT,
  risk_status       VARCHAR(20) DEFAULT 'pending',
  reject_reason     VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS open_positions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(10) NOT NULL UNIQUE,
  action            VARCHAR(10) NOT NULL,
  entry_price       DECIMAL(12,4) NOT NULL,
  shares            DECIMAL(12,4) NOT NULL,
  trade_amount      DECIMAL(12,2) NOT NULL,
  stop_loss_price   DECIMAL(12,4) NOT NULL,
  take_profit_price DECIMAL(12,4) NOT NULL,
  stop_loss_pct     DECIMAL(6,4),
  take_profit_pct   DECIMAL(6,4),
  signal_id         UUID,
  opened_at         TIMESTAMP DEFAULT NOW(),
  session_date      DATE DEFAULT CURRENT_DATE,
  paper_trade       BOOLEAN DEFAULT true,
  robinhood_order_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS closed_positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_position_id UUID,
  ticker           VARCHAR(10),
  action           VARCHAR(10),
  entry_price      DECIMAL(12,4),
  exit_price       DECIMAL(12,4),
  shares           DECIMAL(12,4),
  trade_amount     DECIMAL(12,2),
  pnl              DECIMAL(12,2),
  pnl_pct          DECIMAL(8,4),
  exit_reason      VARCHAR(30),
  opened_at        TIMESTAMP,
  closed_at        TIMESTAMP DEFAULT NOW(),
  sessions_held    INTEGER DEFAULT 0,
  paper_trade      BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS accuracy_tracker (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id           UUID,
  closed_position_id  UUID,
  ticker              VARCHAR(10),
  action              VARCHAR(10),
  predicted_tp_pct    DECIMAL(6,4),
  actual_return_pct   DECIMAL(8,4),
  hit_take_profit     BOOLEAN DEFAULT false,
  hit_stop_loss       BOOLEAN DEFAULT false,
  was_correct         BOOLEAN,
  signal_date         TIMESTAMP,
  evaluated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       VARCHAR(10),
  action       VARCHAR(10),
  shares       DECIMAL(12,4),
  price        DECIMAL(12,4),
  total_amount DECIMAL(12,2),
  signal_id    UUID,
  position_id  UUID,
  source       VARCHAR(20) DEFAULT 'auto',
  executed_at  TIMESTAMP DEFAULT NOW()
);
`;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(SETUP_SQL);
  schemaReady = true;
}

export async function GET() {
  try {
    await ensureSchema();

    const { rows } = await pool.query(`
      SELECT id, status, progress_pct, progress_stage,
             run_at, duration_ms, tickers_scanned, signals_found, trades_executed
      FROM pipeline_runs
      ORDER BY run_at DESC
      LIMIT 1
    `);

    if (!rows.length) {
      return NextResponse.json({ progress: 0, stage: 'Ready — no runs yet', status: 'idle' });
    }

    const run = rows[0];
    const progress = run.status === 'completed' ? 100 : (run.progress_pct ?? 0);

    return NextResponse.json({
      progress,
      stage:           run.progress_stage ?? run.status,
      status:          run.status,
      run_at:          run.run_at,
      duration_ms:     run.duration_ms,
      tickers_scanned: run.tickers_scanned,
      signals_found:   run.signals_found,
      trades_executed: run.trades_executed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ progress: 0, stage: 'DB unavailable', status: 'error', error: msg }, { status: 500 });
  }
}
