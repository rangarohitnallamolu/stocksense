const axios = require('axios');
const pool = require('../shared/db');
const { FINNHUB_KEY, WATCHLIST_SIZE } = require('../shared/config');

async function refresh() {
  const db = await pool.connect();
  try {
    // Get all S&P 500 tickers from existing table
    const { rows: sp500 } = await db.query(
      'SELECT ticker, name, sector FROM sp500_tickers WHERE active = true'
    );

    console.log(`Fetching beta/volatility for ${sp500.length} S&P 500 tickers...`);

    // Fetch metrics for all tickers (beta as volatility proxy)
    const scored = [];
    const batchSize = 10;

    for (let i = 0; i < sp500.length; i += batchSize) {
      const batch = sp500.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async ({ ticker, name, sector }) => {
          try {
            const r = await axios.get(
              `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`,
              { timeout: 5000 }
            );
            const m = r.data?.metric || {};
            const beta = m.beta || 0;
            const vol30 = m['10DayAverageTradingVolume'] || 0;
            return { ticker, name, sector, beta, volatility_30d: vol30, score: Math.abs(beta) };
          } catch { return null; }
        })
      );

      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) scored.push(r.value);
      });

      // Rate limit: Finnhub free tier = 60 calls/min
      if (i + batchSize < sp500.length) await new Promise(r => setTimeout(r, 1200));
      process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, sp500.length)}/${sp500.length}`);
    }

    // Sort by beta (absolute value) descending and take top N
    const top = scored
      .filter(s => s.beta !== 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, WATCHLIST_SIZE);

    console.log(`\nSelected top ${top.length} high-volatility tickers`);

    // Upsert into trading_watchlist
    await db.query('UPDATE trading_watchlist SET active = false');

    for (const t of top) {
      await db.query(
        `INSERT INTO trading_watchlist (ticker, name, sector, beta, volatility_30d, active, last_updated)
         VALUES ($1,$2,$3,$4,$5,true,NOW())
         ON CONFLICT (ticker) DO UPDATE
           SET name=$2, sector=$3, beta=$4, volatility_30d=$5, active=true, last_updated=NOW()`,
        [t.ticker, t.name, t.sector, t.beta, t.volatility_30d]
      );
    }

    console.log(`Watchlist refreshed: ${top.map(t => t.ticker).join(', ')}`);
    return top.map(t => t.ticker);
  } finally {
    db.release();
    await pool.end();
  }
}

refresh().catch(e => { console.error(e.message); process.exit(1); });
