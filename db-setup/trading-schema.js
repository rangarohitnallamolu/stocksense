const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../frontend/.env.local') });

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

const schema = `
-- ─────────────────────────────────────────
-- TRADING AGENTS: AUTO-TRADER SYSTEM
-- ─────────────────────────────────────────

-- Top 30 high-volatility tickers (auto-refreshed weekly)
CREATE TABLE IF NOT EXISTS trading_watchlist (
  ticker            VARCHAR(10) PRIMARY KEY,
  name              VARCHAR(200),
  sector            VARCHAR(100),
  beta              DECIMAL(8,4),
  volatility_30d    DECIMAL(8,4),
  last_price        DECIMAL(12,4),
  last_updated      TIMESTAMP DEFAULT NOW(),
  active            BOOLEAN DEFAULT true
);

-- Every orchestrator loop execution
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at           TIMESTAMP DEFAULT NOW(),
  duration_ms      INTEGER,
  tickers_scanned  INTEGER DEFAULT 0,
  signals_found    INTEGER DEFAULT 0,
  trades_executed  INTEGER DEFAULT 0,
  status           VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  progress_pct     INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  progress_stage   VARCHAR(80) DEFAULT 'Initializing',
  error            TEXT
);

-- Add progress columns to existing table if already created
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS progress_pct    INTEGER DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS progress_stage  VARCHAR(80) DEFAULT 'Initializing';

-- Judge agent output — one row per ticker per run
CREATE TABLE IF NOT EXISTS trade_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id   UUID REFERENCES pipeline_runs(id),
  ticker            VARCHAR(10) NOT NULL,
  action            VARCHAR(10) NOT NULL CHECK (action IN ('BUY','SELL','SHORT','HOLD','SKIP')),
  confidence        INTEGER CHECK (confidence BETWEEN 0 AND 100),
  entry_price       DECIMAL(12,4),
  stop_loss_pct     DECIMAL(6,4),
  take_profit_pct   DECIMAL(6,4),
  stop_loss_price   DECIMAL(12,4),
  take_profit_price DECIMAL(12,4),
  bull_thesis       TEXT,
  bear_thesis       TEXT,
  judge_reasoning   TEXT,
  news_summary      TEXT,
  risk_status       VARCHAR(20) DEFAULT 'pending' CHECK (risk_status IN ('pending','approved','rejected','swap_needed')),
  reject_reason     VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Current open positions (max 3 at a time)
CREATE TABLE IF NOT EXISTS open_positions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(10) NOT NULL UNIQUE,
  action            VARCHAR(10) NOT NULL CHECK (action IN ('BUY','SHORT')),
  entry_price       DECIMAL(12,4) NOT NULL,
  shares            DECIMAL(12,4) NOT NULL,
  trade_amount      DECIMAL(12,2) NOT NULL,
  stop_loss_price   DECIMAL(12,4) NOT NULL,
  take_profit_price DECIMAL(12,4) NOT NULL,
  stop_loss_pct     DECIMAL(6,4),
  take_profit_pct   DECIMAL(6,4),
  signal_id         UUID REFERENCES trade_signals(id),
  opened_at         TIMESTAMP DEFAULT NOW(),
  session_date      DATE DEFAULT CURRENT_DATE,
  paper_trade       BOOLEAN DEFAULT true,
  robinhood_order_id VARCHAR(100)
);

-- Full trade history
CREATE TABLE IF NOT EXISTS closed_positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_position_id UUID,
  ticker           VARCHAR(10) NOT NULL,
  action           VARCHAR(10) NOT NULL,
  entry_price      DECIMAL(12,4) NOT NULL,
  exit_price       DECIMAL(12,4) NOT NULL,
  shares           DECIMAL(12,4) NOT NULL,
  trade_amount     DECIMAL(12,2) NOT NULL,
  pnl              DECIMAL(12,2),
  pnl_pct          DECIMAL(8,4),
  exit_reason      VARCHAR(30) CHECK (exit_reason IN ('stop_loss','take_profit','manual','monitor_exit','emergency')),
  opened_at        TIMESTAMP,
  closed_at        TIMESTAMP DEFAULT NOW(),
  sessions_held    INTEGER DEFAULT 0,
  paper_trade      BOOLEAN DEFAULT true
);

-- Per-signal outcome tracking (for win rate calculation)
CREATE TABLE IF NOT EXISTS accuracy_tracker (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id           UUID REFERENCES trade_signals(id),
  closed_position_id  UUID REFERENCES closed_positions(id),
  ticker              VARCHAR(10) NOT NULL,
  action              VARCHAR(10) NOT NULL,
  predicted_tp_pct    DECIMAL(6,4),
  actual_return_pct   DECIMAL(8,4),
  hit_take_profit     BOOLEAN DEFAULT false,
  hit_stop_loss       BOOLEAN DEFAULT false,
  was_correct         BOOLEAN,
  signal_date         TIMESTAMP,
  evaluated_at        TIMESTAMP DEFAULT NOW()
);

-- Paper trade order log
CREATE TABLE IF NOT EXISTS paper_trades (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       VARCHAR(10) NOT NULL,
  action       VARCHAR(10) NOT NULL CHECK (action IN ('BUY','SELL','SHORT','COVER')),
  shares       DECIMAL(12,4) NOT NULL,
  price        DECIMAL(12,4) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  signal_id    UUID REFERENCES trade_signals(id),
  position_id  UUID,
  source       VARCHAR(20) DEFAULT 'auto' CHECK (source IN ('auto','manual_override')),
  executed_at  TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trade_signals_run    ON trade_signals(pipeline_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_signals_ticker ON trade_signals(ticker, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_open_pos_ticker      ON open_positions(ticker);
CREATE INDEX IF NOT EXISTS idx_closed_pos_ticker    ON closed_positions(ticker, closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_accuracy_ticker      ON accuracy_tracker(ticker, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_paper_trades_ticker  ON paper_trades(ticker, executed_at DESC);
`;

async function run() {
  await client.connect();
  console.log('Connected to RDS');
  await client.query(schema);
  console.log('Trading schema tables created successfully');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
