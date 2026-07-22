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
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       VARCHAR(128) PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(100),
  plan          VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  notify_price     BOOLEAN DEFAULT true,
  notify_news      BOOLEAN DEFAULT true,
  notify_earnings  BOOLEAN DEFAULT true,
  notify_analyst   BOOLEAN DEFAULT true,
  notify_ai_reco   BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             VARCHAR(128) REFERENCES user_profiles(user_id),
  stripe_customer_id  VARCHAR(100),
  stripe_sub_id       VARCHAR(100),
  plan                VARCHAR(20) NOT NULL,
  status              VARCHAR(20) DEFAULT 'active',
  current_period_end  TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PORTFOLIO & WATCHLIST
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(128) REFERENCES user_profiles(user_id),
  ticker      VARCHAR(10) NOT NULL,
  type        VARCHAR(4) NOT NULL CHECK (type IN ('buy','sell')),
  shares      DECIMAL(12,4) NOT NULL,
  price       DECIMAL(12,2) NOT NULL,
  trade_date  DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   VARCHAR(128) REFERENCES user_profiles(user_id),
  ticker    VARCHAR(10) NOT NULL,
  added_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- ─────────────────────────────────────────
-- ALERTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR(128) REFERENCES user_profiles(user_id),
  ticker      VARCHAR(10) NOT NULL,
  alert_type  VARCHAR(20) NOT NULL CHECK (
                alert_type IN ('price_above','price_below','earnings','news','analyst','ai_reco_change')
              ),
  threshold   DECIMAL(12,2),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    UUID REFERENCES alerts(id) ON DELETE SET NULL,
  user_id     VARCHAR(128),
  ticker      VARCHAR(10),
  message     TEXT NOT NULL,
  email_sent  BOOLEAN DEFAULT false,
  fired_at    TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AGENT 1: NEWS & ANALYST MONITOR
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_analysis (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker           VARCHAR(10) NOT NULL,
  headline         TEXT NOT NULL,
  source           VARCHAR(100),
  url              TEXT,
  sentiment        VARCHAR(20) CHECK (sentiment IN ('very_positive','positive','neutral','negative','very_negative')),
  importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
  category         VARCHAR(30),
  is_catalyst      BOOLEAN DEFAULT false,
  catalyst_type    VARCHAR(50),
  catalyst_value   BIGINT,
  catalyst_timeline VARCHAR(50),
  ai_summary       TEXT,
  analyzed_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyst_changes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       VARCHAR(10) NOT NULL,
  firm         VARCHAR(100),
  action       VARCHAR(20) CHECK (action IN ('upgrade','downgrade','initiation','reiterate','target_change')),
  from_rating  VARCHAR(30),
  to_rating    VARCHAR(30),
  old_target   DECIMAL(10,2),
  new_target   DECIMAL(10,2),
  detected_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent1_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tickers_scanned INTEGER,
  news_processed  INTEGER,
  catalysts_found INTEGER,
  analyst_changes INTEGER,
  high_importance INTEGER,
  run_at        TIMESTAMP DEFAULT NOW(),
  duration_ms   INTEGER
);

-- ─────────────────────────────────────────
-- AGENT 2: STOCK RECOMMENDATIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker              VARCHAR(10) NOT NULL,
  recommendation      VARCHAR(20) NOT NULL CHECK (
                        recommendation IN ('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL')
                      ),
  confidence_score    INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  price_at_analysis   DECIMAL(10,2),
  price_target_12m    DECIMAL(10,2),
  upside_pct          DECIMAL(6,2),
  reasoning           TEXT,
  score_breakdown     JSONB,
  key_catalysts       JSONB,
  key_risks           JSONB,
  agent1_run_id       UUID,
  generated_at        TIMESTAMP DEFAULT NOW()
);

-- Track recommendation changes for email notification
CREATE TABLE IF NOT EXISTS recommendation_changes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            VARCHAR(10) NOT NULL,
  prev_recommendation VARCHAR(20),
  new_recommendation  VARCHAR(20),
  prev_confidence   INTEGER,
  new_confidence    INTEGER,
  change_reason     TEXT,
  emails_sent       INTEGER DEFAULT 0,
  changed_at        TIMESTAMP DEFAULT NOW()
);

-- Track record: outcome of past recommendations
CREATE TABLE IF NOT EXISTS recommendation_outcomes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id),
  ticker            VARCHAR(10) NOT NULL,
  recommendation    VARCHAR(20) NOT NULL,
  price_at_reco     DECIMAL(10,2),
  price_target      DECIMAL(10,2),
  price_30d         DECIMAL(10,2),
  price_90d         DECIMAL(10,2),
  price_180d        DECIMAL(10,2),
  return_30d        DECIMAL(6,2),
  return_90d        DECIMAL(6,2),
  return_180d       DECIMAL(6,2),
  outcome           VARCHAR(20),
  checked_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent2_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tickers_analyzed    INTEGER,
  recommendations_new INTEGER,
  recommendations_changed INTEGER,
  emails_triggered    INTEGER,
  run_at              TIMESTAMP DEFAULT NOW(),
  duration_ms         INTEGER
);

-- ─────────────────────────────────────────
-- S&P 500 UNIVERSE (scanned by agents)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sp500_tickers (
  ticker    VARCHAR(10) PRIMARY KEY,
  name      VARCHAR(200),
  sector    VARCHAR(100),
  active    BOOLEAN DEFAULT true
);

-- ─────────────────────────────────────────
-- MISC
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider  VARCHAR(50),
  endpoint  VARCHAR(100),
  called_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  ticker        VARCHAR(10) NOT NULL,
  analysis_text TEXT NOT NULL,
  model_used    VARCHAR(50),
  generated_at  TIMESTAMP DEFAULT NOW(),
  expires_at    TIMESTAMP,
  PRIMARY KEY (ticker)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_news_ticker_time    ON news_analysis(ticker, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyst_ticker_time ON analyst_changes(ticker, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_reco_ticker_time    ON recommendations(ticker, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reco_outcomes       ON recommendation_outcomes(ticker, recommendation);
CREATE INDEX IF NOT EXISTS idx_watchlist_user      ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user         ON alerts(user_id, is_active);
`;

async function run() {
  await client.connect();
  console.log('Connected to RDS');
  await client.query(schema);
  console.log('All tables created successfully');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
