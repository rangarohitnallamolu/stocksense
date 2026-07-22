const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../frontend/.env.local') });
const c = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'), user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
});
c.connect().then(() => Promise.all([
  c.query('SELECT tickers_analyzed, recommendations_new, input_tokens, output_tokens, cost_usd, run_at FROM agent2_runs ORDER BY run_at DESC LIMIT 3'),
  c.query("SELECT agent, SUM(input_tokens) tin, SUM(output_tokens) tout, SUM(cost_usd) cost, COUNT(*) calls FROM token_usage_log WHERE logged_at > NOW() - INTERVAL '2 hours' GROUP BY agent"),
  c.query('SELECT agent, AVG(input_tokens) avg_in, AVG(output_tokens) avg_out, AVG(cost_usd) avg_cost FROM token_usage_log WHERE logged_at > NOW() - interval \'2 hours\' GROUP BY agent'),
])).then(([runs, totals, avgs]) => {
  console.log('\n=== Agent2 recent runs ===');
  runs.rows.forEach(r => console.log(JSON.stringify(r)));
  console.log('\n=== Token totals (last 2h) ===');
  totals.rows.forEach(r => console.log(JSON.stringify(r)));
  console.log('\n=== Averages per call (last 2h) ===');
  avgs.rows.forEach(r => console.log(JSON.stringify(r)));
  c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
