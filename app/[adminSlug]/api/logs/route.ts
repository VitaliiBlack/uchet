import { NextResponse } from 'next/server';
import { getDataSource } from '@/lib/typeorm';
import { requireAdmin } from '@/lib/adminGuard';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ adminSlug: string }> }
) {
  const { adminSlug } = await context.params;
  const guard = await requireAdmin(request, adminSlug);
  if ('response' in guard) {
    return guard.response;
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const limitRaw = Number(searchParams.get('limit') ?? 200);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 200;

  const dataSource = await getDataSource();
  const params: unknown[] = [];
  let where = '';
  if (type) {
    params.push(type);
    where = 'WHERE type = $1';
  }
  params.push(limit);

  const events = await dataSource.query(
    'SELECT id, type, user_id, email, ip, detail, created_at FROM security_events ' +
      where +
      ' ORDER BY id DESC LIMIT $' + params.length,
    params
  );

  return NextResponse.json({ events });
}
