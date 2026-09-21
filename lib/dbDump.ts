import { gzipSync } from 'node:zlib';
import { mkdir, readdir, stat, unlink, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportSqlDump } from '@/lib/dbExport';

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
const RETAIN = Math.max(1, Number(process.env.BACKUP_RETAIN ?? 10));

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Human-readable snapshot name: <prefix>_<DD.MM.YYYY>_<HH-MM-SS>.sql.gz
 * e.g. uchet_20.09.2026_20-21-53.sql.gz
 */
export const snapshotFilename = (prefix = 'uchet', date = new Date()): string =>
  prefix +
  '_' +
  pad2(date.getDate()) +
  '.' +
  pad2(date.getMonth() + 1) +
  '.' +
  date.getFullYear() +
  '_' +
  pad2(date.getHours()) +
  '-' +
  pad2(date.getMinutes()) +
  '-' +
  pad2(date.getSeconds()) +
  '.sql.gz';

export interface SnapshotInfo {
  filename: string;
  bytes: number;
  createdAt: string;
}

export interface SnapshotResult extends SnapshotInfo {
  content: Buffer;
}

/** Best-effort: on serverless the filesystem is read-only/ephemeral. */
export const ensureBackupDir = async (): Promise<string | null> => {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    return BACKUP_DIR;
  } catch {
    return null;
  }
};

export const listSnapshots = async (): Promise<SnapshotInfo[]> => {
  const dir = await ensureBackupDir();
  if (!dir) {
    return [];
  }
  const names = await readdir(BACKUP_DIR).catch(() => [] as string[]);
  const snapshots: SnapshotInfo[] = [];
  for (const name of names) {
    if (!name.endsWith('.sql.gz')) continue;
    const info = await stat(path.join(BACKUP_DIR, name)).catch(() => null);
    if (!info || !info.isFile()) continue;
    snapshots.push({ filename: name, bytes: info.size, createdAt: info.mtime.toISOString() });
  }
  return snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Guards against path traversal: only plain snapshot names are allowed. */
export const isSafeSnapshotName = (name: string): boolean =>
  /^[A-Za-z0-9._-]+\.sql\.gz$/.test(name) && !name.includes('..');

export const readSnapshot = async (name: string): Promise<Buffer> => {
  if (!isSafeSnapshotName(name)) {
    throw new Error('invalid snapshot name');
  }
  return readFile(path.join(BACKUP_DIR, name));
};

/**
 * Creates a snapshot from the in-process SQL export (no pg_dump), persists it to
 * disk when possible and always returns the content so the caller can ship it
 * to Telegram — the durable copy on serverless.
 */
export const createSnapshot = async (): Promise<SnapshotResult> => {
  const sql = await exportSqlDump();
  const content = gzipSync(sql);
  const filename = snapshotFilename();
  const createdAt = new Date().toISOString();

  const dir = await ensureBackupDir();
  if (dir) {
    try {
      await writeFile(path.join(BACKUP_DIR, filename), content);
      await applyRetention();
    } catch {
      /* read-only filesystem on serverless — Telegram keeps the artifact */
    }
  }

  return { filename, bytes: content.length, createdAt, content };
};

/** Keeps only the newest RETAIN snapshots. */
export const applyRetention = async (): Promise<void> => {
  const snapshots = await listSnapshots();
  for (const old of snapshots.slice(RETAIN)) {
    await unlink(path.join(BACKUP_DIR, old.filename)).catch(() => undefined);
  }
};

export const backupDir = BACKUP_DIR;
export const backupRetain = RETAIN;
