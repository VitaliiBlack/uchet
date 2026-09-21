// Standalone DB snapshot: pg_dump -> backups/<ts>.sql.gz -> optional Telegram.
//
// Usage:  node scripts/snapshot.mjs [--telegram]
// Cron:   0 3 */3 * * cd /Users/vitalijgribinik/HomeProjects/uchet && \
//           /usr/bin/env node scripts/snapshot.mjs --telegram >> /tmp/uchet-snapshot.log 2>&1
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { mkdir, readdir, stat, unlink, writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(root, 'backups');
const RETAIN = Math.max(1, Number(process.env.BACKUP_RETAIN ?? 10));
const MAX_BUFFER = 512 * 1024 * 1024;

const loadEnv = () => {
  try {
    const text = readFileSync(new URL('../.env.development.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)="?([^"\n]*)"?$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    /* env may already be provided */
  }
};

const parseDb = () => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return {
      user: decodeURIComponent(url.username) || 'uchet',
      db: url.pathname.replace(/^\//, '') || 'uchet',
    };
  } catch {
    return { user: 'uchet', db: 'uchet' };
  }
};

const dump = async () => {
  const mode = process.env.PG_DUMP_MODE ?? 'local';
  const attempts = [];
  const dockerDump = async () => {
    const { user, db } = parseDb();
    const container = process.env.PG_DOCKER_CONTAINER ?? 'uchet-local-db';
    const { stdout } = await execFileAsync(
      'docker',
      ['exec', container, 'pg_dump', '-U', user, '-d', db, '--no-owner', '--no-acl'],
      { maxBuffer: MAX_BUFFER, encoding: 'buffer' }
    );
    return Buffer.from(stdout);
  };
  const localDump = async () => {
    const { stdout } = await execFileAsync(
      'pg_dump',
      [process.env.DATABASE_URL, '--no-owner', '--no-acl'],
      { maxBuffer: MAX_BUFFER, encoding: 'buffer' }
    );
    return Buffer.from(stdout);
  };
  if (mode === 'docker') attempts.push(dockerDump);
  else if (mode === 'local') attempts.push(localDump, dockerDump);
  else attempts.push(dockerDump, localDump);

  const errors = [];
  for (const attempt of attempts) {
    try {
      const buffer = await attempt();
      if (buffer.length > 0) return buffer;
      errors.push('empty dump');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error('pg_dump failed: ' + errors.join(' | '));
};

const applyRetention = async () => {
  const names = (await readdir(BACKUP_DIR)).filter((n) => n.endsWith('.sql.gz'));
  const withTime = [];
  for (const name of names) {
    const info = await stat(path.join(BACKUP_DIR, name));
    withTime.push({ name, mtime: info.mtimeMs });
  }
  withTime.sort((a, b) => b.mtime - a.mtime);
  for (const old of withTime.slice(RETAIN)) {
    await unlink(path.join(BACKUP_DIR, old.name)).catch(() => undefined);
  }
};

const sendTelegram = async (filename, content) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return false;
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', '💾 Дамп БД uchet · ' + new Date().toLocaleString('ru-RU'));
  form.append('document', new Blob([new Uint8Array(content)]), filename);
  const res = await fetch('https://api.telegram.org/bot' + token + '/sendDocument', {
    method: 'POST',
    body: form,
  });
  return res.ok;
};

const main = async () => {
  loadEnv();
  await mkdir(BACKUP_DIR, { recursive: true });
  const sql = await dump();
  const gzip = gzipSync(sql);
  const pad = (value) => String(value).padStart(2, '0');
  const now = new Date();
  const filename =
    'uchet_' +
    pad(now.getDate()) + '.' + pad(now.getMonth() + 1) + '.' + now.getFullYear() +
    '_' + pad(now.getHours()) + '-' + pad(now.getMinutes()) + '-' + pad(now.getSeconds()) +
    '.sql.gz';
  await writeFile(path.join(BACKUP_DIR, filename), gzip);
  await applyRetention();
  console.log('Snapshot written: ' + filename + ' (' + gzip.length + ' bytes)');

  if (process.argv.includes('--telegram')) {
    const sent = await sendTelegram(filename, await readFile(path.join(BACKUP_DIR, filename)));
    console.log(sent ? 'Sent to Telegram' : 'Telegram not configured or failed');
  }
};

main().catch((error) => {
  console.error('Snapshot failed:', error);
  process.exit(1);
});
