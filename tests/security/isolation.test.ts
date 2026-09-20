import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/lib/auth';
import { resetRateLimits } from '@/lib/rateLimit';
import {
  DELETE as opsDelete,
  GET as opsGet,
  POST as opsPost,
  PUT as opsPut,
} from '@/app/api/financial-data/route';
import { GET as wsGet, POST as wsPost } from '@/app/api/workspaces/route';
import {
  DELETE as wsDelete,
  PATCH as wsPatch,
} from '@/app/api/workspaces/[id]/route';
import { POST as wsRestore } from '@/app/api/workspaces/[id]/restore/route';
import {
  GET as membersGet,
  POST as membersPost,
} from '@/app/api/workspaces/[id]/members/route';
import { DELETE as memberDelete } from '@/app/api/workspaces/[id]/members/[userId]/route';
import { POST as register } from '@/app/api/auth/register/route';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const authMock = vi.mocked(auth);

const signInAs = (id: number | null, version = 0) =>
  authMock.mockResolvedValue(
    (id === null ? null : { user: { id: String(id) }, sessionVersion: version }) as never
  );

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

// users: 1=A(owner ws1), 2=B(editor on ws1), 3=C(owner ws2), 4=lonely(no shop)
const seed = async () => {
  await pool.query(
    'TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE'
  );
  await pool.query(
    "INSERT INTO users (email, password) VALUES ('a@t.dev','x'), ('b@t.dev','x'), ('c@t.dev','x'), ('lonely@t.dev','x')"
  );
  await pool.query(
    "INSERT INTO workspaces (user_id, name) VALUES (1,'A-shop'), (3,'C-shop')"
  );
  await pool.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (1, 2, 'editor')"
  );
  await pool.query(
    "INSERT INTO financial_operations (user_id, workspace_id, date, income, expense, description) VALUES (1,1,'2026-09-01',10,0,'a'), (3,2,'2026-09-01',30,0,'c')"
  );
};

describe('cross-tenant isolation (pentest)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimits();
    await seed();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('stranger cannot read/rename/archive another workspace', async () => {
    signInAs(1); // A targets C-shop (ws2)
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=2'))).status).toBe(404);
    expect((await wsPatch(jsonReq('http://x/api/workspaces/2', 'PATCH', { name: 'x' }), ctx({ id: '2' }))).status).toBe(404);
    expect((await wsDelete(new Request('http://x/api/workspaces/2', { method: 'DELETE' }), ctx({ id: '2' }))).status).toBe(404);
    expect((await membersGet(new Request('http://x/api/workspaces/2/members'), ctx({ id: '2' }))).status).toBe(404);
  });

  it('owner can rename/archive, and archive blocks access until restore', async () => {
    signInAs(1);
    expect((await wsPatch(jsonReq('http://x/api/workspaces/1', 'PATCH', { name: 'A-2' }), ctx({ id: '1' }))).status).toBe(200);
    expect((await wsDelete(new Request('http://x/api/workspaces/1', { method: 'DELETE' }), ctx({ id: '1' }))).status).toBe(200);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(404);
    expect((await membersGet(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }))).status).toBe(404);
    expect((await wsRestore(new Request('http://x/api/workspaces/1/restore', { method: 'POST' }), ctx({ id: '1' }))).status).toBe(200);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(200);
  });

  it('non-owner cannot restore an archived workspace', async () => {
    signInAs(1);
    await wsDelete(new Request('http://x/api/workspaces/1', { method: 'DELETE' }), ctx({ id: '1' }));
    signInAs(3); // C
    expect((await wsRestore(new Request('http://x/api/workspaces/1/restore', { method: 'POST' }), ctx({ id: '1' }))).status).toBe(404);
  });

  it('editor cannot manage the workspace', async () => {
    signInAs(2); // B = editor on ws1
    expect((await wsPatch(jsonReq('http://x/api/workspaces/1', 'PATCH', { name: 'x' }), ctx({ id: '1' }))).status).toBe(404);
    expect((await wsDelete(new Request('http://x/api/workspaces/1', { method: 'DELETE' }), ctx({ id: '1' }))).status).toBe(404);
    expect((await membersGet(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }))).status).toBe(404);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'c@t.dev' }), ctx({ id: '1' }))).status).toBe(404);
    expect((await memberDelete(new Request('http://x/api/workspaces/1/members/1', { method: 'DELETE' }), ctx({ id: '1', userId: '1' }))).status).toBe(404);
    expect((await wsRestore(new Request('http://x/api/workspaces/1/restore', { method: 'POST' }), ctx({ id: '1' }))).status).toBe(404);
  });

  it('editor can work only with operations of the shared workspace', async () => {
    signInAs(2);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(200);
    expect((await opsPost(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-09-02', income: 5, workspaceId: 1 }))).status).toBe(200);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=2'))).status).toBe(404);
    expect((await opsPost(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-09-02', income: 5, workspaceId: 2 }))).status).toBe(404);
  });

  it('owner can add a member by email; editor/stranger cannot', async () => {
    signInAs(1);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'c@t.dev' }), ctx({ id: '1' }))).status).toBe(201);
    const body = (await (await membersGet(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }))).json()) as { members: Array<{ email: string }> };
    expect(body.members.map((m) => m.email).sort()).toEqual(['b@t.dev', 'c@t.dev']);

    signInAs(2);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'c@t.dev' }), ctx({ id: '1' }))).status).toBe(404);

    signInAs(1);
    expect((await membersPost(jsonReq('http://x/api/workspaces/2/members', 'POST', { email: 'c@t.dev' }), ctx({ id: '2' }))).status).toBe(404);
  });

  it('owner can remove a member; editor/stranger cannot', async () => {
    signInAs(1);
    expect((await memberDelete(new Request('http://x/api/workspaces/1/members/2', { method: 'DELETE' }), ctx({ id: '1', userId: '2' }))).status).toBe(200);
    const afterRemove = (await (
      await membersGet(new Request('http://x/api/workspaces/1/members'), ctx({ id: '1' }))
    ).json()) as { members: unknown[] };
    expect(afterRemove.members.length).toBe(0);

    signInAs(1);
    expect((await memberDelete(new Request('http://x/api/workspaces/2/members/3', { method: 'DELETE' }), ctx({ id: '2', userId: '3' }))).status).toBe(404);
  });

  it('user with no workspace cannot read any operations by default', async () => {
    signInAs(4); // lonely
    expect((await opsGet(new Request('http://x/api/financial-data'))).status).toBe(404);
    expect((await getWorkspacesListCount())).toBe(0);
  });

  it('cannot touch another workspace operation id even with own workspaceId', async () => {
    signInAs(1);
    expect((await opsPut(jsonReq('http://x/api/financial-data', 'PUT', { id: 2, income: 1, workspaceId: 1 }))).status).toBe(404);
    expect((await opsDelete(new Request('http://x/api/financial-data?id=2&workspaceId=1', { method: 'DELETE' }))).status).toBe(404);
    expect((await opsPut(jsonReq('http://x/api/financial-data', 'PUT', { id: 2, income: 1, workspaceId: 2 }))).status).toBe(404);
  });

  it('rejects malformed/injection input without 500', async () => {
    signInAs(1);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1%20OR%201=1'))).status).toBe(404);
    expect((await opsGet(new Request('http://x/api/financial-data?date=2026-02-30&workspaceId=1'))).status).toBe(400);
    expect((await opsGet(new Request('http://x/api/financial-data?date=1%27--&workspaceId=1'))).status).toBe(400);
    expect((await opsDelete(new Request('http://x/api/financial-data?id=1%20OR%201=1&workspaceId=1', { method: 'DELETE' }))).status).toBe(400);
    expect((await opsPost(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-02-30', income: 1, workspaceId: 1 }))).status).toBe(400);
    expect((await wsPatch(jsonReq('http://x/api/workspaces/1', 'PATCH', { name: 'x' }), ctx({ id: 'abc' }))).status).toBe(404);
    expect((await memberDelete(new Request('http://x/api/workspaces/1/members/abc', { method: 'DELETE' }), ctx({ id: '1', userId: 'abc' }))).status).toBe(404);
  });

  it('ignores mass-assignment of ownership fields', async () => {
    signInAs(1);
    const res = await wsPost(jsonReq('http://x/api/workspaces', 'POST', { name: 'M', user_id: 999, is_owner: true }));
    expect(res.status).toBe(201);
    const rows = await pool.query("SELECT user_id FROM workspaces WHERE name = 'M'");
    expect(rows.rows[0].user_id).toBe(1);
  });

  it('register: lowercases email, blocks case-insensitive duplicates, rate-limits', async () => {
    expect((await register(jsonReq('http://x/api/auth/register', 'POST', { email: '  New@Test.Dev ', password: 'ValidPass123' }))).status).toBe(201);
    const rows = await pool.query("SELECT email FROM users WHERE id = 5");
    expect(rows.rows[0].email).toBe('new@test.dev');

    expect((await register(jsonReq('http://x/api/auth/register', 'POST', { email: 'NEW@test.dev', password: 'ValidPass123' }))).status).toBe(409);

    let sawTooMany = false;
    for (let i = 0; i < 12; i++) {
      const status = (await register(jsonReq('http://x/api/auth/register', 'POST', { email: `rl-${i}@test.dev`, password: 'ValidPass123' }))).status;
      if (status === 429) sawTooMany = true;
    }
    expect(sawTooMany).toBe(true);
  });

  async function getWorkspacesListCount(): Promise<number> {
    const res = await wsGet(new Request('http://x/api/workspaces'));
    const list = (await res.json()) as unknown[];
    return list.length;
  }
});
