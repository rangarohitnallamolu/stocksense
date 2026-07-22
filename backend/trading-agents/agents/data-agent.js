const axios = require('axios');
const { FINNHUB_KEY, FMP_KEY } = require('../shared/config');

const BASE_FH = 'https://finnhub.io/api/v1';
const BASE_FMP = 'https://financialmodelingprep.com/api/v3';
const TIMEOUT = 5000;

async function fh(path) {
  try {
    const r = await axios.get(`${BASE_FH}${path}&token=${FINNHUB_KEY}`, { timeout: TIMEOUT });
    return r.data;
  } catch { return null; }
}

async function fmp(path) {
  try {
    const r = await axios.get(`${BASE_FMP}${path}&apikey=${FMP_KEY}`, { timeout: TIMEOUT });
    return r.data;
  } catch { return null; }
}

async function fetchSnapshot(ticker) {
  const [quote, metrics, candles] = await Promise.all([
    fh(`/quote?symbol=${ticker}`),
    fh(`/stock/metric?symbol=${ticker}&metric=all`),
    fh(`/stock/candle?symbol=${ticker}&resolution=D&from=${daysAgo(60)}&to=${now()}`),
  ]);

  if (!quote || !quote.c) return null;

  const m = metrics?.metric || {};
  const closes = candles?.c || [];

  const sma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null;
  const sma50 = closes.length >= 50 ? avg(closes.slice(-50)) : null;
  const atr14 = computeATR(candles, 14);

  return {
    ticker,
    price:          quote.c,
    change:         quote.d,
    change_pct:     quote.dp,
    open:           quote.o,
    high:           quote.h,
    low:            quote.l,
    prev_close:     quote.pc,
    volume:         quote.v || 0,
    week52_high:    m['52WeekHigh']   || null,
    week52_low:     m['52WeekLow']    || null,
    beta:           m['beta']          || null,
    pe_ratio:       m['peNormalizedAnnual'] || null,
    market_cap:     m['marketCapitalization'] || null,
    sma20,
    sma50,
    atr14,
    above_sma20:    sma20 ? quote.c > sma20 : null,
    above_sma50:    sma50 ? quote.c > sma50 : null,
    pct_from_52h:   m['52WeekHigh'] ? ((quote.c - m['52WeekHigh']) / m['52WeekHigh']) * 100 : null,
    pct_from_52l:   m['52WeekLow']  ? ((quote.c - m['52WeekLow'])  / m['52WeekLow'])  * 100 : null,
    fetched_at:     new Date().toISOString(),
  };
}

async function fetchAll(tickers) {
  const results = await Promise.allSettled(tickers.map(fetchSnapshot));
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

function avg(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function computeATR(candles, period) {
  if (!candles?.h?.length || candles.h.length < period + 1) return null;
  const { h, l, c } = candles;
  const trs = [];
  for (let i = 1; i < h.length; i++) {
    trs.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  }
  return avg(trs.slice(-period));
}

function now()     { return Math.floor(Date.now() / 1000); }
function daysAgo(n) { return Math.floor((Date.now() - n * 86400000) / 1000); }

module.exports = { fetchAll, fetchSnapshot };
