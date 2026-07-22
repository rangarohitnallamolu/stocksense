import { NextRequest, NextResponse } from 'next/server';
import { fetchChartData, Period } from '@/lib/stock-data';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const period = (req.nextUrl.searchParams.get('period') || '1M') as Period;
  try {
    const data = await fetchChartData(ticker, period);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
