import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/api';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { is_active } = await req.json();

  const result = await pool.query(
    `UPDATE alerts SET is_active=$1 WHERE id=$2 AND user_id=$3 RETURNING *`,
    [is_active, id, userId]
  );
  if (!result.rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await pool.query('DELETE FROM alerts WHERE id=$1 AND user_id=$2', [id, userId]);
  return NextResponse.json({ deleted: id });
}
