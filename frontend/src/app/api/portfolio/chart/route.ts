import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/api';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const PERIOD_MAP: Record<string, { range: string; interval: string }> = {
  '1W': { range: '5d',  interval: '1h'  },
  '1M': { range: '1mo', interval: '1d'  },
  '3M': { range: '3mo', interval: '1d'  },
  '1Y': { range: '1y',  interval: '1wk' },
};

interface PricePoint { dateKey: string; time: number; close: number; }
interface TxRow { ticker: string; type: string; shares: number; price: number; trade_date: string; }

async function fetchYahooHistory(ticker: string, range: string, interval: string): Promise<PricePoint[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`,
      { headers: { 'User-Agent': UA }, next: { revalidate: 1800 } }
    );
    const json = await r.json();
    const result = json?.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const closes = result.indicators.quote[0].close;
    return result.timestamp
      .map((ts: number, i: number) => ({
        dateKey: new Date(ts * 1000).toISOString().split('T')[0],
        time:    ts,
        close:   closes[i] ?? 0,
      }))
      .filter((p: PricePoint) => p.close > 0);
  } catch { return []; }
}

async function fetchCurrentPrice(ticker: string): Promise<{ price: number; time: number }> {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
      { next: { revalidate: 30 } }
    );
    const d = await r.json();
    return { price: d.c ?? 0, time: d.t ?? Math.floor(Date.now() / 1000) };
  } catch { return { price: 0, time: Math.floor(Date.now() / 1000) }; }
}

function sharesHeldOnDate(txns: TxRow[], ticker: string, dateKey: string): number {
  return txns
    .filter(t => t.ticker === ticker && t.trade_date <= dateKey)
    .reduce((acc, t) => acc + (t.type === 'buy' ? Number(t.shares) : -Number(t.shares)), 0);
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const period = req.nextUrl.searchParams.get('period') || '1M';
  const cfg    = PERIOD_MAP[period] || PERIOD_MAP['1M'];
  const today  = new Date().toISOString().split('T')[0];

  // Get all transactions
  const txRes = await pool.query<TxRow>(
    `SELECT ticker, type, shares::float, price::float, trade_date::text
     FROM transactions WHERE user_id=$1 ORDER BY trade_date ASC`,
    [userId]
  );

  if (!txRes.rows.length) return NextResponse.json([]);

  const txns   = txRes.rows;
  const tickers = [...new Set(txns.map(t => t.ticker))];

  // Fetch historical prices + live prices in parallel
  const [histories, liveQuotes] = await Promise.all([
    Promise.all(tickers.map(t => fetchYahooHistory(t, cfg.range, cfg.interval))),
    Promise.all(tickers.map(t => fetchCurrentPrice(t))),
  ]);

  // Price maps: ticker → dateKey → close
  const priceMap: Record<string, Record<string, number>> = {};
  tickers.forEach((ticker, i) => {
    priceMap[ticker] = {};
    histories[i].forEach(p => { priceMap[ticker][p.dateKey] = p.close; });
  });

  // Collect all historical dates
  const histDates = [...new Set(
    histories.flatMap(h => h.map(p => p.dateKey))
  )].sort();

  // Time map: dateKey → unix timestamp
  const timeMap: Record<string, number> = {};
  histories.forEach(h => h.forEach(p => { timeMap[p.dateKey] = p.time; }));

  // Build series from historical dates
  const series: { time: number; value: number }[] = histDates
    .map(dateKey => {
      let total = 0;
      tickers.forEach((ticker, i) => {
        const held  = sharesHeldOnDate(txns, ticker, dateKey);
        if (held <= 0) return;
        const price = priceMap[ticker][dateKey] ?? 0;
        total += held * price;
      });
      return { time: timeMap[dateKey], value: Math.round(total * 100) / 100 };
    })
    .filter(p => p.value > 0);

  // ─── Always add / replace today's value using live prices ───────────────────
  let todayTotal = 0;
  tickers.forEach((ticker, i) => {
    const held  = sharesHeldOnDate(txns, ticker, today);
    const price = liveQuotes[i].price;
    if (held > 0 && price > 0) todayTotal += held * price;
  });
  todayTotal = Math.round(todayTotal * 100) / 100;

  if (todayTotal > 0) {
    // Remove any stale today entry from historical series, then append live value
    const withoutToday = series.filter(p => {
      const d = new Date(p.time * 1000).toISOString().split('T')[0];
      return d < today;
    });
    const todayTs = Math.max(...liveQuotes.map(q => q.time));
    series.length = 0;
    series.push(...withoutToday, { time: todayTs, value: todayTotal });
  }

  // ─── Edge case: first trade was today — no historical data yet ───────────────
  // Add a cost-basis starting point so the chart has ≥2 points to render
  if (series.length === 1) {
    const costBasis = txns
      .filter(t => t.type === 'buy')
      .reduce((acc, t) => acc + Number(t.shares) * Number(t.price), 0);

    if (costBasis > 0) {
      const firstTradeTs = new Date(txns[0].trade_date + 'T09:30:00Z').getTime() / 1000;
      series.unshift({ time: firstTradeTs, value: Math.round(costBasis * 100) / 100 });
    }
  }

  // ─── Edge case: no series at all but user has live holdings ─────────────────
  if (series.length === 0 && todayTotal > 0) {
    const costBasis = txns
      .filter(t => t.type === 'buy')
      .reduce((acc, t) => acc + Number(t.shares) * Number(t.price), 0);
    const firstTradeTs = new Date(txns[0].trade_date + 'T09:30:00Z').getTime() / 1000;
    const todayTs = Math.floor(Date.now() / 1000);
    series.push(
      { time: firstTradeTs, value: Math.round(costBasis * 100) / 100 },
      { time: todayTs,      value: todayTotal }
    );
  }

  return NextResponse.json(series);
}
