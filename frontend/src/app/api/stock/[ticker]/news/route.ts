import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const key  = process.env.FINNHUB_API_KEY!;
  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

  try {
    const res  = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker.toUpperCase()}&from=${from}&to=${to}&token=${key}`,
      { next: { revalidate: 900 } }
    );
    const data = await res.json();
    const articles = (Array.isArray(data) ? data : [])
      .filter((a: { headline: string; url: string }) => a.headline && a.url)
      .slice(0, 15);
    return NextResponse.json(articles);
  } catch {
    return NextResponse.json([]);
  }
}
