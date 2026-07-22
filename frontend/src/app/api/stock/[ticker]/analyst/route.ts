import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

async function fetchFinnhub(path: string, key: string) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1${path}&token=${key}`,
      { next: { revalidate: 3600 } });
    return await r.json();
  } catch { return null; }
}

async function fetchQuote(ticker: string, key: string) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`,
      { next: { revalidate: 60 } });
    const d = await r.json();
    return { price: d.c ?? 0, changePct: d.dp ?? 0 };
  } catch { return { price: 0, changePct: 0 }; }
}

async function fetchProfile(ticker: string, key: string) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`,
      { next: { revalidate: 3600 } });
    const d = await r.json();
    return { name: d.name || ticker, industry: d.finnhubIndustry || '' };
  } catch { return { name: ticker, industry: '' }; }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  const key   = process.env.FINNHUB_API_KEY!;

  const [earnings, rawPeers, aiReco] = await Promise.all([
    fetchFinnhub(`/stock/earnings?symbol=${upper}&limit=8`, key),
    fetchFinnhub(`/stock/peers?symbol=${upper}`, key),
    pool.query(
      `SELECT recommendation, confidence_score, price_target_12m, upside_pct,
              reasoning, score_breakdown, key_catalysts, key_risks, generated_at
       FROM recommendations WHERE ticker=$1 ORDER BY generated_at DESC LIMIT 1`,
      [upper]
    ),
  ]);

  // Peers — exclude itself, deduplicate, keep top 5 legit tickers
  const peers: string[] = [...new Set(
    ((rawPeers as string[]) || [])
      .filter((t: string) => t !== upper && /^[A-Z]{1,5}$/.test(t))
  )].slice(0, 5);

  // Fetch peer quotes + profiles in parallel
  const peerData = await Promise.all(
    peers.map(async t => {
      const [q, p] = await Promise.all([fetchQuote(t, key), fetchProfile(t, key)]);
      return { ticker: t, ...q, ...p };
    })
  );

  // Compute EPS growth (most recent vs one year ago)
  const earningsArr = Array.isArray(earnings) ? earnings : [];
  let epsGrowth: number | null = null;
  if (earningsArr.length >= 5) {
    const latest = earningsArr[0]?.actual;
    const yearAgo = earningsArr[4]?.actual;
    if (latest && yearAgo && yearAgo !== 0) {
      epsGrowth = ((latest - yearAgo) / Math.abs(yearAgo)) * 100;
    }
  }

  // Deduplicate earnings by year+quarter (Finnhub can return duplicates)
  const seen = new Set<string>();
  const uniqueEarnings = earningsArr.filter(e => {
    const k = `${e.year}-Q${e.quarter}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return NextResponse.json({
    earnings:  uniqueEarnings.slice(0, 8),
    peers:     peerData,
    epsGrowth,
    aiReco:    aiReco.rows[0] || null,
  });
}
