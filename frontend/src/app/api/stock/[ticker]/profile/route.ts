import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const key = process.env.FINNHUB_API_KEY;

  try {
    const [profileRes, metricsRes, aiReco] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`, { next: { revalidate: 3600 } }),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${key}`, { next: { revalidate: 3600 } }),
      pool.query(
        `SELECT recommendation, confidence_score, price_target_12m, upside_pct, reasoning, generated_at
         FROM recommendations WHERE ticker=$1 ORDER BY generated_at DESC LIMIT 1`,
        [ticker]
      ),
    ]);

    const [profile, metricsData] = await Promise.all([profileRes.json(), metricsRes.json()]);
    const m = metricsData.metric || {};

    return NextResponse.json({
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
        pb:           m.pbAnnual || null,
        eps:          m.epsNormalizedAnnual || null,
        roe:          m.roeAnnual || null,
        roa:          m.roaAnnual || null,
        netMargin:    m.netProfitMarginAnnual || null,
        grossMargin:  m.grossMarginAnnual || null,
        beta:         m.beta || null,
        week52High:   m['52WeekHigh'] || null,
        week52Low:    m['52WeekLow'] || null,
        week52Return: m['52WeekPriceReturnDaily'] || null,
        dividendYield:m.dividendYieldIndicatedAnnual || null,
        debtEquity:   m.totalDebt_totalEquityAnnual || null,
        currentRatio: m.currentRatioAnnual || null,
      },
      aiReco: aiReco.rows[0] || null,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
