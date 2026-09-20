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
  const countsRows = await dataSource.query(
    `SELECT
       (SELECT count(*) FROM users)::int AS users,
       (SELECT count(*) FROM workspaces WHERE archived_at IS NULL)::int AS workspaces,
       (SELECT count(*) FROM financial_operations)::int AS operations,
       (SELECT count(*) FROM workspace_members WHERE status = 'accepted')::int AS members,
       (SELECT count(*) FROM admin_users)::int AS admins,
       (SELECT pg_database_size(current_database()))::bigint AS db_bytes`
  );

  const events = await dataSource.query(
    `SELECT id, type, user_id, email, ip, detail, created_at
       FROM security_events
       ORDER BY id DESC
       LIMIT 50`
  );

  return NextResponse.json({ counts: countsRows[0], events });
}
