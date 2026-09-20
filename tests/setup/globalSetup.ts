import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const PG = {
  host: '127.0.0.1',
  port: 55432,
  user: 'uchet',
  password: 'uchet_local_dev',
};

const TEST_DB = 'uchet_test';
const adminUrl = `postgresql://${PG.user}:${PG.password}@${PG.host}:${PG.port}/postgres`;
const testUrl = `postgresql://${PG.user}:${PG.password}@${PG.host}:${PG.port}/${TEST_DB}`;

export async function setup() {
  const admin = new Pool({ connectionString: adminUrl });
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DB,
    ]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${TEST_DB}`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: testUrl });
  try {
    const root = process.cwd();
    await pool.query(readFileSync(path.join(root, 'docker/initdb/00-base-schema.sql'), 'utf8'));

    const migrationsDir = path.join(root, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const file of files) {
      await pool.query(readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}
