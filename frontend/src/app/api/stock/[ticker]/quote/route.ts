import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const key = process.env.FINNHUB_API_KEY;

  try {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`, { next: { revalidate: 60 } }),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`, { next: { revalidate: 3600 } }),
    ]);
    const [quote, profile] = await Promise.all([quoteRes.json(), profileRes.json()]);

    return NextResponse.json({
      ticker,
      name:          profile.name        || ticker,
      exchange:      profile.exchange     || '',
      industry:      profile.finnhubIndustry || '',
      logo:          profile.logo         || '',
      marketCap:     profile.marketCapitalization || 0,
      price:         quote.c  || 0,
      change:        quote.d  || 0,
      changePct:     quote.dp || 0,
      high:          quote.h  || 0,
      low:           quote.l  || 0,
      open:          quote.o  || 0,
      prevClose:     quote.pc || 0,
      timestamp:     quote.t  || 0,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
