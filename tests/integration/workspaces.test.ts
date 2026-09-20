import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  getActiveWorkspaces,
  getOwnedWorkspaceById,
  getWorkspaceById,
  resolveWorkspaceId,
} from '@/lib/workspaces';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const seed = async () => {
  await pool.query(
    'TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE'
  );
  await pool.query(
    "INSERT INTO users (email, password) VALUES ('a@test.dev','x'), ('b@test.dev','x')"
  );
  await pool.query(
    "INSERT INTO workspaces (user_id, name) VALUES (1,'A-shop'), (2,'B-shop')"
  );
  // B is an editor on A's workspace
  await pool.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 2, 'editor')"
  );
  await pool.query(
    "INSERT INTO financial_operations (user_id, workspace_id, date, income, expense, description) VALUES (1,1,'2026-09-01',1,0,'a'), (2,2,'2026-09-01',2,0,'b')"
  );
};

describe('workspace authorization (integration, real DB)', () => {
  beforeEach(seed);
  afterAll(async () => {
    await pool.end();
  });

  it('lists owned + shared active workspaces', async () => {
    const a = await getActiveWorkspaces(1);
    expect(a.map((w) => w.id)).toEqual([1]);

    const b = await getActiveWorkspaces(2);
    expect(b.map((w) => [w.id, w.access_role, w.is_owner])).toEqual([
      [1, 'editor', false],
      [2, 'owner', true],
    ]);
  });

  it('getWorkspaceById enforces membership (no IDOR)', async () => {
    expect(await getWorkspaceById(1, 2)).toBeNull();
    expect(await getWorkspaceById(2, 2)).not.toBeNull();
    expect(await getWorkspaceById(2, 1)).not.toBeNull();
  });

  it('getOwnedWorkspaceById returns only owned workspaces', async () => {
    expect(await getOwnedWorkspaceById(2, 1)).toBeNull();
    expect(await getOwnedWorkspaceById(1, 1)).not.toBeNull();
  });

  it('resolveWorkspaceId rejects foreign/invalid ids', async () => {
    expect(await resolveWorkspaceId(1, 2)).toBeNull();
    expect(await resolveWorkspaceId(1, 1)).toBe(1);
    expect(await resolveWorkspaceId(1, 'abc')).toBeNull();
    expect(await resolveWorkspaceId(1, '-5')).toBeNull();
  });

  it('archived workspaces are hidden by default', async () => {
    await pool.query("UPDATE workspaces SET archived_at = now() WHERE id = 1");
    expect(await getWorkspaceById(1, 1)).toBeNull();
    expect(await getWorkspaceById(1, 1, true)).not.toBeNull();
    expect(await getOwnedWorkspaceById(1, 1, true)).not.toBeNull();
  });
});
