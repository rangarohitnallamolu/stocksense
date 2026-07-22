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

const sql = `
ALTER TABLE agent1_runs
  ADD COLUMN IF NOT EXISTS input_tokens  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd      DECIMAL(10,6) DEFAULT 0;

ALTER TABLE agent2_runs
  ADD COLUMN IF NOT EXISTS input_tokens  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd      DECIMAL(10,6) DEFAULT 0;

CREATE TABLE IF NOT EXISTS token_usage_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent         VARCHAR(10) NOT NULL,
  ticker        VARCHAR(10),
  model         VARCHAR(50),
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      DECIMAL(10,6),
  logged_at     TIMESTAMP DEFAULT NOW()
);
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('Token tracking columns added'); client.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
