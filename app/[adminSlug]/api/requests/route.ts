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
  const requests = await dataSource.query(
    `SELECT id, user_id, email, ip, detail, created_at
       FROM security_events
       WHERE type = 'password_reset_request'
       ORDER BY id DESC
       LIMIT 100`
  );

  return NextResponse.json({ requests });
}
