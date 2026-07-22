require('dotenv').config({ path: require('path').join(__dirname, '../../../frontend/.env.local') });

module.exports = {
  // Trade sizing — user sets TRADE_AMOUNT in .env.local
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT || '1000'),

  // Risk defaults (user can override in .env.local)
  DEFAULT_STOP_LOSS_PCT: parseFloat(process.env.STOP_LOSS_PCT || '5'),    // 5%
  DEFAULT_TAKE_PROFIT_PCT: parseFloat(process.env.TAKE_PROFIT_PCT || '15'), // 15%

  // Position limits
  MAX_OPEN_POSITIONS: 3,
  MIN_CONFIDENCE: 65, // skip signals below this

  // Pipeline
  LOOP_INTERVAL_MINUTES: 10,
  WATCHLIST_SIZE: 30,
  WATCHLIST_REFRESH_DAYS: 7,

  // Market hours (ET)
  MARKET_OPEN:  { h: 9,  m: 30 },
  MARKET_CLOSE: { h: 16, m: 0  },

  // API keys
  FINNHUB_KEY: process.env.FINNHUB_API_KEY,
  FMP_KEY:     process.env.FMP_API_KEY,
  ANTHROPIC_KEY: process.env.ANTHROPIC_API_KEY,

  // Models
  MODEL_ANALYSIS: 'claude-sonnet-4-6',
  MODEL_FILTER:   'claude-haiku-4-5-20251001',

  // Paper trading
  PAPER_TRADING: process.env.PAPER_TRADING !== 'false', // true by default

  // Swap threshold: only consider swapping a position if new signal confidence
  // exceeds the weakest position's by this margin
  SWAP_CONFIDENCE_MARGIN: 15,
};
