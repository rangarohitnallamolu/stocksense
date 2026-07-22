import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 1) return NextResponse.json([]);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${process.env.FINNHUB_API_KEY}`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    const results = (data.result || [])
      .filter((r: { type: string; symbol: string }) =>
        r.type === 'Common Stock' && !r.symbol.includes('.')
      )
      .slice(0, 8)
      .map((r: { symbol: string; description: string }) => ({
        ticker:  r.symbol,
        name:    r.description,
      }));
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
