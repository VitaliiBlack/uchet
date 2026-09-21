import { getDataSource } from '@/lib/typeorm';

// Only the app's own tables, in foreign-key-safe insert order. A shared Neon
// database may also contain other projects' tables; never dump those.
const APP_TABLES = [
  'users',
  'workspaces',
  'financial_operations',
  'workspace_members',
  'admin_users',
  'user_sessions',
  'security_events',
];

const IDENT = /^[a-z_][a-z0-9_]*$/;

const sqlLiteral = (value: string | null): string =>
  value === null ? 'NULL' : "'" + value.replace(/'/g, "''") + "'";

/**
 * Builds a portable SQL dump by reading the app's tables with the pg client.
 * Unlike pg_dump it needs no shell or binary, so it works on Vercel/serverless
 * too. All values are cast to text and quoted, which restores fine via psql.
 */
export const exportSqlDump = async (): Promise<Buffer> => {
  const dataSource = await getDataSource();

  const existingRows: { table_name: string }[] = await dataSource.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  const existing = new Set(existingRows.map((row) => row.table_name));
  const tables = APP_TABLES.filter((name) => IDENT.test(name) && existing.has(name));

  const out: string[] = [];
  out.push('-- uchet database dump');
  out.push('-- generated: ' + new Date().toISOString());
  out.push('BEGIN;');

  for (const table of tables) {
    const columnRows: { column_name: string }[] = await dataSource.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND is_generated = 'NEVER'
        ORDER BY ordinal_position`,
      [table]
    );
    const columns = columnRows
      .map((row) => row.column_name)
      .filter((name) => IDENT.test(name));
    if (columns.length === 0) {
      continue;
    }

    const selectList = columns.map((c) => '"' + c + '"::text AS "' + c + '"').join(', ');
    const rows: Record<string, string | null>[] = await dataSource.query(
      'SELECT ' + selectList + ' FROM "' + table + '"'
    );
    if (rows.length === 0) {
      continue;
    }

    const columnList = columns.map((c) => '"' + c + '"').join(', ');
    out.push('');
    out.push('-- ' + table + ': ' + rows.length + ' rows');
    for (const row of rows) {
      const values = columns.map((c) => sqlLiteral(row[c] ?? null)).join(', ');
      out.push('INSERT INTO "' + table + '" (' + columnList + ') VALUES (' + values + ');');
    }
  }

  out.push('');
  out.push('COMMIT;');
  return Buffer.from(out.join('\n'), 'utf8');
};
