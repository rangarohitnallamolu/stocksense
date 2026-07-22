import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.FINNHUB_API_KEY!;
  try {
    const [general, crypto] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`, { next: { revalidate: 900 } }),
      fetch(`https://finnhub.io/api/v1/news?category=technology&token=${key}`, { next: { revalidate: 900 } }),
    ]);
    const [gData, cData] = await Promise.all([general.json(), crypto.json()]);

    const combined = [
      ...(Array.isArray(gData) ? gData : []),
      ...(Array.isArray(cData) ? cData : []),
    ]
      .filter((a: { headline: string; url: string }) => a.headline && a.url)
      .sort((a: { datetime: number }, b: { datetime: number }) => b.datetime - a.datetime);

    // Deduplicate by id
    const seen = new Set<number>();
    const unique = combined.filter((a: { id: number }) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    }).slice(0, 20);

    return NextResponse.json(unique);
  } catch {
    return NextResponse.json([]);
  }
}
