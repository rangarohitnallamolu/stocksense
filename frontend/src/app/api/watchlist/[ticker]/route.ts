import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/api';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ticker } = await params;
  await pool.query(
    'DELETE FROM watchlist WHERE user_id=$1 AND ticker=$2',
    [userId, ticker.toUpperCase()]
  );
  return NextResponse.json({ watching: false });
}
