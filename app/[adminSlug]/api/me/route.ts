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

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    'SELECT id, email, last_login_at FROM admin_users WHERE id = $1 LIMIT 1',
    [guard.session.adminId]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ admin: rows[0] });
}
