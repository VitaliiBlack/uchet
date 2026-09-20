import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/lib/auth';
import {
  DELETE as deleteOp,
  GET as getOps,
  POST as postOp,
  PUT as putOp,
} from '@/app/api/financial-data/route';
import { GET as getWorkspaces } from '@/app/api/workspaces/route';
import {
  GET as getMembers,
  POST as postMember,
} from '@/app/api/workspaces/[id]/members/route';
import { POST as register } from '@/app/api/auth/register/route';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const authMock = vi.mocked(auth);

const signInAs = (id: number | null) => {
  authMock.mockResolvedValue(
    (id === null ? null : { user: { id: String(id) } }) as never
  );
};

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

describe('API authorization (mocked auth, real DB)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await pool.query(
      'TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE'
    );
    await pool.query(
      "INSERT INTO users (email, password) VALUES ('a@test.dev','x'), ('b@test.dev','x')"
    );
    await pool.query(
      "INSERT INTO workspaces (user_id, name) VALUES (1,'A-shop'), (2,'B-shop')"
    );
    await pool.query(
      "INSERT INTO financial_operations (user_id, workspace_id, date, income, expense, description) VALUES (1,1,'2026-09-01',10,0,'a'), (2,2,'2026-09-01',20,0,'b')"
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns 401 for unauthenticated requests', async () => {
    signInAs(null);
    expect((await getOps(new Request('http://x/api/financial-data'))).status).toBe(401);
    expect((await getWorkspaces(new Request('http://x/api/workspaces'))).status).toBe(401);
    expect(
      (await postOp(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-09-01', income: 1, workspaceId: 1 }))).status
    ).toBe(401);
  });

  it('does not leak other users data (IDOR -> 404)', async () => {
    signInAs(1);
    expect((await getOps(new Request('http://x/api/financial-data?workspaceId=2'))).status).toBe(404);
    expect(
      (await postOp(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-09-01', income: 1, workspaceId: 2 }))).status
    ).toBe(404);
    expect(
      (await putOp(jsonReq('http://x/api/financial-data', 'PUT', { id: 2, income: 5, workspaceId: 2 }))).status
    ).toBe(404);
    expect(
      (await putOp(jsonReq('http://x/api/financial-data', 'PUT', { id: 2, income: 5, workspaceId: 1 }))).status
    ).toBe(404);
    expect(
      (await deleteOp(new Request('http://x/api/financial-data?id=2&workspaceId=2', { method: 'DELETE' }))).status
    ).toBe(404);
    expect(
      (await deleteOp(new Request('http://x/api/financial-data?id=2&workspaceId=1', { method: 'DELETE' }))).status
    ).toBe(404);
  });

  it('reads own workspace data', async () => {
    signInAs(1);
    const res = await getOps(new Request('http://x/api/financial-data?workspaceId=1'));
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ description: string }>;
    expect(rows.map((r) => r.description)).toEqual(['a']);
  });

  it('rejects non-integer id with 400 (regression: was 500)', async () => {
    signInAs(1);
    const res = await deleteOp(
      new Request('http://x/api/financial-data?id=1%20OR%201=1&workspaceId=1', { method: 'DELETE' })
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid date with 400', async () => {
    signInAs(1);
    expect((await getOps(new Request('http://x/api/financial-data?date=nope&workspaceId=1'))).status).toBe(400);
  });

  it('lists only own workspaces', async () => {
    signInAs(1);
    const res = await getWorkspaces(new Request('http://x/api/workspaces'));
    const list = (await res.json()) as Array<{ id: number }>;
    expect(list.map((w) => w.id)).toEqual([1]);
  });

  it('members endpoint has no availableUsers leak', async () => {
    signInAs(1);
    const res = await getMembers(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('members');
    expect(body).not.toHaveProperty('availableUsers');
  });

  it('editor cannot list members', async () => {
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1,2,'editor')"
    );
    signInAs(2);
    expect(
      (await getMembers(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }))).status
    ).toBe(404);
  });

  it('add member: unknown email -> 404, invalid email -> 400', async () => {
    signInAs(1);
    expect(
      (await postMember(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'nobody@nowhere.dev' }), ctx({ id: '1' }))).status
    ).toBe(404);
    expect(
      (await postMember(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'nope' }), ctx({ id: '1' }))).status
    ).toBe(400);
  });

  it('register validates email and password', async () => {
    signInAs(null);
    expect(
      (await register(jsonReq('http://x/api/auth/register', 'POST', { email: 'nope', password: 'ValidPass123' }))).status
    ).toBe(400);
    expect(
      (await register(jsonReq('http://x/api/auth/register', 'POST', { email: 'ok@test.dev', password: 'a' }))).status
    ).toBe(400);
  });
});
