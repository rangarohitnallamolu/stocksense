const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../frontend/.env.local') });

const client = new Client({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

// Top 100 S&P 500 by market cap
const tickers = [
  ['AAPL','Apple Inc.','Technology'],['MSFT','Microsoft Corp.','Technology'],
  ['NVDA','NVIDIA Corp.','Technology'],['AMZN','Amazon.com Inc.','Consumer Cyclical'],
  ['GOOGL','Alphabet Inc.','Technology'],['META','Meta Platforms','Technology'],
  ['TSLA','Tesla Inc.','Consumer Cyclical'],['BRK.B','Berkshire Hathaway','Financials'],
  ['UNH','UnitedHealth Group','Healthcare'],['XOM','Exxon Mobil','Energy'],
  ['JNJ','Johnson & Johnson','Healthcare'],['JPM','JPMorgan Chase','Financials'],
  ['V','Visa Inc.','Financials'],['LLY','Eli Lilly','Healthcare'],
  ['AVGO','Broadcom Inc.','Technology'],['PG','Procter & Gamble','Consumer Staples'],
  ['MA','Mastercard Inc.','Financials'],['HD','Home Depot','Consumer Cyclical'],
  ['CVX','Chevron Corp.','Energy'],['MRK','Merck & Co.','Healthcare'],
  ['ABBV','AbbVie Inc.','Healthcare'],['COST','Costco Wholesale','Consumer Staples'],
  ['AMD','Advanced Micro Devices','Technology'],['PEP','PepsiCo Inc.','Consumer Staples'],
  ['KO','Coca-Cola Co.','Consumer Staples'],['WMT','Walmart Inc.','Consumer Staples'],
  ['CRM','Salesforce Inc.','Technology'],['BAC','Bank of America','Financials'],
  ['TMO','Thermo Fisher Scientific','Healthcare'],['ACN','Accenture plc','Technology'],
  ['MCD','McDonald\'s Corp.','Consumer Cyclical'],['ADBE','Adobe Inc.','Technology'],
  ['NFLX','Netflix Inc.','Communication Services'],['CSCO','Cisco Systems','Technology'],
  ['ABT','Abbott Laboratories','Healthcare'],['LIN','Linde plc','Materials'],
  ['TXN','Texas Instruments','Technology'],['DHR','Danaher Corp.','Healthcare'],
  ['NEE','NextEra Energy','Utilities'],['PM','Philip Morris','Consumer Staples'],
  ['ORCL','Oracle Corp.','Technology'],['RTX','Raytheon Technologies','Industrials'],
  ['T','AT&T Inc.','Communication Services'],['QCOM','Qualcomm Inc.','Technology'],
  ['HON','Honeywell International','Industrials'],['UPS','United Parcel Service','Industrials'],
  ['IBM','IBM Corp.','Technology'],['AMGN','Amgen Inc.','Healthcare'],
  ['LOW','Lowe\'s Companies','Consumer Cyclical'],['SPGI','S&P Global Inc.','Financials'],
  ['CAT','Caterpillar Inc.','Industrials'],['GS','Goldman Sachs','Financials'],
  ['BLK','BlackRock Inc.','Financials'],['DE','Deere & Company','Industrials'],
  ['ELV','Elevance Health','Healthcare'],['INTU','Intuit Inc.','Technology'],
  ['ISRG','Intuitive Surgical','Healthcare'],['MDLZ','Mondelez International','Consumer Staples'],
  ['GILD','Gilead Sciences','Healthcare'],['PLD','Prologis Inc.','Real Estate'],
  ['ADI','Analog Devices','Technology'],['REGN','Regeneron Pharma','Healthcare'],
  ['AXP','American Express','Financials'],['VRTX','Vertex Pharma','Healthcare'],
  ['MO','Altria Group','Consumer Staples'],['CVS','CVS Health','Healthcare'],
  ['CI','Cigna Group','Healthcare'],['SLB','SLB (Schlumberger)','Energy'],
  ['ZTS','Zoetis Inc.','Healthcare'],['PANW','Palo Alto Networks','Technology'],
  ['KLAC','KLA Corp.','Technology'],['LRCX','Lam Research','Technology'],
  ['SNPS','Synopsys Inc.','Technology'],['CDNS','Cadence Design','Technology'],
  ['MELI','MercadoLibre','Consumer Cyclical'],['CRWD','CrowdStrike Holdings','Technology'],
  ['ANET','Arista Networks','Technology'],['WDAY','Workday Inc.','Technology'],
  ['DDOG','Datadog Inc.','Technology'],['SNOW','Snowflake Inc.','Technology'],
  ['PLTR','Palantir Technologies','Technology'],['NET','Cloudflare Inc.','Technology'],
  ['COIN','Coinbase Global','Financials'],['UBER','Uber Technologies','Technology'],
  ['ABNB','Airbnb Inc.','Consumer Cyclical'],['SHOP','Shopify Inc.','Technology'],
  ['SQ','Block Inc.','Technology'],['ROKU','Roku Inc.','Technology'],
  ['RBLX','Roblox Corp.','Technology'],['RIVN','Rivian Automotive','Consumer Cyclical'],
  ['LCID','Lucid Group','Consumer Cyclical'],['F','Ford Motor Co.','Consumer Cyclical'],
  ['GM','General Motors','Consumer Cyclical'],['GE','GE Aerospace','Industrials'],
  ['BA','Boeing Co.','Industrials'],['LMT','Lockheed Martin','Industrials'],
  ['NOC','Northrop Grumman','Industrials'],['GD','General Dynamics','Industrials'],
  ['SPY','SPDR S&P 500 ETF','ETF'],['QQQ','Invesco QQQ ETF','ETF'],
];

async function seed() {
  await client.connect();
  for (const [ticker, name, sector] of tickers) {
    await client.query(
      `INSERT INTO sp500_tickers (ticker, name, sector) VALUES ($1,$2,$3)
       ON CONFLICT (ticker) DO NOTHING`,
      [ticker, name, sector]
    );
  }
  console.log(`Seeded ${tickers.length} tickers into sp500_tickers`);
  await client.end();
}

seed().catch(e => { console.error(e.message); process.exit(1); });
