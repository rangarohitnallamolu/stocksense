const FINNHUB = 'https://finnhub.io/api/v1';
const YAHOO   = 'https://query1.finance.yahoo.com/v8/finance/chart';
const KEY     = () => process.env.FINNHUB_API_KEY!;
const UA      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export type Period = '1D' | '1W' | '1M' | '3M' | '1Y';

// Yahoo Finance period/interval config
const YAHOO_CONFIG: Record<Period, { range: string; interval: string; revalidate: number }> = {
  '1D':  { range: '1d',  interval: '5m',  revalidate: 60   },
  '1W':  { range: '5d',  interval: '60m', revalidate: 300  },
  '1M':  { range: '1mo', interval: '1d',  revalidate: 1800 },
  '3M':  { range: '3mo', interval: '1d',  revalidate: 1800 },
  '1Y':  { range: '1y',  interval: '1wk', revalidate: 3600 },
};

export interface ChartPoint {
  time:  number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
  value: number;
}

export async function fetchChartData(ticker: string, period: Period = '1M'): Promise<ChartPoint[]> {
  const cfg = YAHOO_CONFIG[period];
  try {
    const res = await fetch(
      `${YAHOO}/${ticker}?interval=${cfg.interval}&range=${cfg.range}`,
      {
        headers: { 'User-Agent': UA },
        next: { revalidate: cfg.revalidate },
      }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const { timestamp: ts, indicators } = result;
    const q = indicators.quote[0];

    return ts
      .map((t: number, i: number) => ({
        time:  t,
        open:  q.open?.[i]  ?? 0,
        high:  q.high?.[i]  ?? 0,
        low:   q.low?.[i]   ?? 0,
        close: q.close?.[i] ?? 0,
        value: q.close?.[i] ?? 0,
      }))
      .filter((p: ChartPoint) => p.value > 0); // remove null candles (market closed slots)
  } catch {
    return [];
  }
}

export async function fetchQuoteAndProfile(ticker: string) {
  const [quoteRes, profileRes] = await Promise.all([
    fetch(`${FINNHUB}/quote?symbol=${ticker}&token=${KEY()}`,          { next: { revalidate: 30   } }),
    fetch(`${FINNHUB}/stock/profile2?symbol=${ticker}&token=${KEY()}`, { next: { revalidate: 3600 } }),
  ]);
  const [quote, profile] = await Promise.all([quoteRes.json(), profileRes.json()]);
  return {
    ticker,
    name:      profile.name || ticker,
    exchange:  profile.exchange || '',
    industry:  profile.finnhubIndustry || '',
    logo:      profile.logo || '',
    marketCap: profile.marketCapitalization || 0,
    price:     quote.c  || 0,
    change:    quote.d  || 0,
    changePct: quote.dp || 0,
    high:      quote.h  || 0,
    low:       quote.l  || 0,
    open:      quote.o  || 0,
    prevClose: quote.pc || 0,
  };
}

export async function fetchMetricsAndProfile(ticker: string) {
  const [profileRes, metricsRes] = await Promise.all([
    fetch(`${FINNHUB}/stock/profile2?symbol=${ticker}&token=${KEY()}`,           { next: { revalidate: 3600 } }),
    fetch(`${FINNHUB}/stock/metric?symbol=${ticker}&metric=all&token=${KEY()}`,  { next: { revalidate: 3600 } }),
  ]);
  const [profile, metricsData] = await Promise.all([profileRes.json(), metricsRes.json()]);
  const m = metricsData.metric || {};
  return {
    profile: {
      name:        profile.name || ticker,
      ticker,
      exchange:    profile.exchange || '',
      industry:    profile.finnhubIndustry || '',
      logo:        profile.logo || '',
      website:     profile.weburl || '',
      description: profile.description || '',
      employees:   profile.employeeTotal || null,
      ipo:         profile.ipo || '',
      country:     profile.country || 'US',
      marketCap:   profile.marketCapitalization || 0,
      shares:      profile.shareOutstanding || 0,
    },
    metrics: {
      pe:           m.peNormalizedAnnual || m.peTTM || null,
      pb:           m.pbAnnual           || null,
      eps:          m.epsNormalizedAnnual || null,
      roe:          m.roeAnnual           || null,
      roa:          m.roaAnnual           || null,
      netMargin:    m.netProfitMarginAnnual || null,
      grossMargin:  m.grossMarginAnnual   || null,
      beta:         m.beta                || null,
      week52High:   m['52WeekHigh']       || null,
      week52Low:    m['52WeekLow']        || null,
      week52Return: m['52WeekPriceReturnDaily'] || null,
      dividendYield:m.dividendYieldIndicatedAnnual || null,
      debtEquity:   m.totalDebt_totalEquityAnnual  || null,
      currentRatio: m.currentRatioAnnual  || null,
    },
  };
}
