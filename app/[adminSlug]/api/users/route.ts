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
  const users = await dataSource.query(
    `SELECT
       u.id,
       u.email,
       (SELECT count(*) FROM workspaces w WHERE w.user_id = u.id)::int AS workspaces,
       (SELECT count(*) FROM financial_operations fo WHERE fo.user_id = u.id)::int AS operations,
       (SELECT max(created_at) FROM security_events se
          WHERE se.user_id = u.id AND se.type = 'login_ok') AS last_login,
       (SELECT count(*) FROM security_events sf
          WHERE sf.user_id = u.id AND sf.type = 'login_fail')::int AS failed_logins
     FROM users u
     ORDER BY u.id ASC
     LIMIT 500`
  );

  return NextResponse.json({ users });
}
