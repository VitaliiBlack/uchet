import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { verifyCredentials } from '@/lib/credentials';
import { resetRateLimits } from '@/lib/rateLimit';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PASSWORD = 'CorrectHorse!1';

const seed = async () => {
  await pool.query(
    'TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE'
  );
  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [
    'user@test.dev',
    hash,
  ]);
};

describe('verifyCredentials (integration: real DB + bcrypt)', () => {
  beforeEach(async () => {
    resetRateLimits();
    await seed();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('accepts correct credentials', async () => {
    await expect(verifyCredentials('user@test.dev', PASSWORD)).resolves.toEqual({
      id: 1,
      email: 'user@test.dev',
      sessionVersion: 0,
      mustChangePassword: false,
      tempPasswordSetAt: null,
    });
  });

  it('is case-insensitive and trims the email', async () => {
    await expect(verifyCredentials('  USER@Test.Dev ', PASSWORD)).resolves.toMatchObject({
      email: 'user@test.dev',
    });
  });

  it('rejects a wrong password', async () => {
    await expect(verifyCredentials('user@test.dev', 'nope')).resolves.toBeNull();
  });

  it('rejects an unknown user', async () => {
    await expect(verifyCredentials('ghost@test.dev', PASSWORD)).resolves.toBeNull();
  });

  it('rejects empty input', async () => {
    await expect(verifyCredentials('', '')).resolves.toBeNull();
    await expect(verifyCredentials('user@test.dev', '')).resolves.toBeNull();
    await expect(verifyCredentials(undefined, undefined)).resolves.toBeNull();
  });

  it('never leaks whether a user exists (same null result)', async () => {
    expect(await verifyCredentials('user@test.dev', 'wrong')).toBeNull();
    expect(await verifyCredentials('ghost@test.dev', 'wrong')).toBeNull();
  });

  it('rate-limits repeated attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await verifyCredentials('user@test.dev', 'wrong' + i);
    }
    await expect(verifyCredentials('user@test.dev', PASSWORD)).resolves.toBeNull();
  });
});
