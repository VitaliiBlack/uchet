import { NextResponse } from 'next/server';
import { getDataSource } from '@/lib/typeorm';
import { requireAdmin } from '@/lib/adminGuard';
import { listSnapshots, backupDir, backupRetain } from '@/lib/dbDump';

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
  const tables = await dataSource.query(
    `SELECT relname AS name,
            n_live_tup::int AS rows,
            pg_total_relation_size(relid)::bigint AS bytes
       FROM pg_stat_user_tables
       ORDER BY pg_total_relation_size(relid) DESC`
  );
  const dbSize = await dataSource.query(
    'SELECT pg_database_size(current_database())::bigint AS bytes'
  );

  return NextResponse.json({
    snapshots: await listSnapshots(),
    tables,
    dbBytes: dbSize[0]?.bytes ?? 0,
    backupDir,
    retain: backupRetain,
  });
}
