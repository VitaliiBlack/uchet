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
import { GET as wsGet } from '@/app/api/workspaces/route';
import { POST as membersPost } from '@/app/api/workspaces/[id]/members/route';
import { DELETE as memberDelete } from '@/app/api/workspaces/[id]/members/[userId]/route';
import { POST as inviteAction } from '@/app/api/invitations/[id]/route';

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

// Group A: users 1..4 own/serve workspaces 1..4. Group B: users 5..8 / workspaces 5..8.
const VISIBLE: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  2: [1, 2],
  3: [2, 3],
  4: [1, 3, 4],
  5: [5, 6, 7, 8],
  6: [5, 6],
  7: [6, 7],
  8: [5, 7, 8],
};
const SECRETS: Record<number, string> = {
  1: 'SECRET_A1', 2: 'SECRET_A2', 3: 'SECRET_A3', 4: 'SECRET_A4',
  5: 'SECRET_B1', 6: 'SECRET_B2', 7: 'SECRET_B3', 8: 'SECRET_B4',
};

const seed = async () => {
  await pool.query('TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE');
  await pool.query(
    "INSERT INTO users (email, password) VALUES ('a1@t.dev','x'),('a2@t.dev','x'),('a3@t.dev','x'),('a4@t.dev','x'),('b1@t.dev','x'),('b2@t.dev','x'),('b3@t.dev','x'),('b4@t.dev','x')"
  );
  await pool.query(
    "INSERT INTO workspaces (user_id, name) VALUES (1,'Shop1'),(1,'Shop2'),(1,'Shop3'),(1,'Shop4'),(5,'Shop1'),(5,'Shop2'),(5,'Shop3'),(5,'Shop4')"
  );
  await pool.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES (1,2,'editor','accepted'),(2,2,'editor','accepted'),(2,3,'editor','accepted'),(3,3,'editor','accepted'),(1,4,'editor','accepted'),(3,4,'editor','accepted'),(4,4,'editor','accepted'),(5,6,'editor','accepted'),(6,6,'editor','accepted'),(6,7,'editor','accepted'),(7,7,'editor','accepted'),(5,8,'editor','accepted'),(7,8,'editor','accepted'),(8,8,'editor','accepted')"
  );
  for (const [ws, secret] of Object.entries(SECRETS)) {
    await pool.query(
      "INSERT INTO financial_operations (user_id, workspace_id, date, income, expense, description) VALUES (1,$1,'2026-09-01',1,0,$2)",
      [Number(ws), secret]
    );
  }
};

const visibleIds = async (userId: number): Promise<number[]> => {
  signInAs(userId);
  const list = (await (await wsGet(new Request('http://x/api/workspaces'))).json()) as Array<{ id: number }>;
  return list.map((w) => w.id).sort((a, b) => a - b);
};

describe('two-tenant isolation matrix (ABC vs DEF)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimits();
    await seed();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('each user sees exactly their own + accepted workspaces (never the other group)', async () => {
    for (const userId of Object.keys(VISIBLE).map(Number)) {
      expect(await visibleIds(userId), 'user ' + userId).toEqual(VISIBLE[userId]);
    }
  });

  it('full cross matrix: no user can read/write any foreign workspace (404)', async () => {
    const opRows = (await pool.query('SELECT id, workspace_id FROM financial_operations')).rows as Array<{ id: number; workspace_id: number }>;
    const opByWs = new Map(opRows.map((r) => [Number(r.workspace_id), Number(r.id)]));

    for (const userId of Object.keys(VISIBLE).map(Number)) {
      const allowed = new Set(VISIBLE[userId]);
      for (let ws = 1; ws <= 8; ws++) {
        const foreign = !allowed.has(ws);
        signInAs(userId);

        const g = (await opsGet(new Request('http://x/api/financial-data?workspaceId=' + ws))).status;
        const p = (await opsPost(jsonReq('http://x/api/financial-data', 'POST', { date: '2026-09-02', income: 5, workspaceId: ws }))).status;
        const u = (await opsPut(jsonReq('http://x/api/financial-data', 'PUT', { id: opByWs.get(ws), income: 5, workspaceId: ws }))).status;
        const d = (await opsDelete(new Request('http://x/api/financial-data?id=' + opByWs.get(ws) + '&workspaceId=' + ws, { method: 'DELETE' }))).status;

        const label = 'u' + userId + '/ws' + ws;
        if (foreign) {
          expect([g, p, u, d], label).toEqual([404, 404, 404, 404]);
        } else {
          expect(g, label).toBe(200);
        }
      }
    }
  });

  it('no secret marker from a foreign group ever appears in responses', async () => {
    for (const userId of Object.keys(VISIBLE).map(Number)) {
      const allowed = new Set(VISIBLE[userId]);
      for (let ws = 1; ws <= 8; ws++) {
        signInAs(userId);
        const body = await (await opsGet(new Request('http://x/api/financial-data?workspaceId=' + ws))).text();
        const leak = Object.entries(SECRETS).some(([secretWs, secret]) => !allowed.has(Number(secretWs)) && body.includes(secret));
        expect(leak, 'u' + userId + ' leaked foreign secret via ws' + ws).toBe(false);
      }
    }
  });

  it('cross-group invite requires consent and grants only that one shop', async () => {
    // a1 invites b2 into A-shop1 (workspace 1)
    signInAs(1);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'b2@t.dev' }), ctx({ id: '1' }))).status).toBe(201);

    // before consent: b2 sees nothing of A
    expect(await visibleIds(6)).toEqual([5, 6]);
    signInAs(6);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(404);

    // a1 cannot see any B workspace
    for (let ws = 5; ws <= 8; ws++) {
      signInAs(1);
      expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=' + ws))).status).toBe(404);
    }

    // b2 accepts
    signInAs(6);
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'accept' }), ctx({ id: '1' }))).status).toBe(200);
    expect(await visibleIds(6)).toEqual([1, 5, 6]);

    // b2 sees ONLY workspace 1 from group A, not 2/3/4
    signInAs(6);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(200);
    for (const ws of [2, 3, 4]) {
      expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=' + ws))).status).toBe(404);
    }
    // and still no B data visible to a1
    signInAs(1);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=5'))).status).toBe(404);
  });

  it('consent cannot be bypassed, spoofed or mass-assigned', async () => {
    // outsider accept -> 404
    signInAs(7);
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'accept' }), ctx({ id: '1' }))).status).toBe(404);
    // editor cannot add members
    signInAs(2);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'b3@t.dev' }), ctx({ id: '1' }))).status).toBe(404);
    // unauthenticated
    signInAs(null);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'b3@t.dev' }), ctx({ id: '1' }))).status).toBe(401);
    // mass-assignment on add: status/role/owner forced
    signInAs(1);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'b3@t.dev', status: 'accepted', role: 'owner', is_owner: true }), ctx({ id: '1' }))).status).toBe(201);
    const row = (await pool.query("SELECT role, status FROM workspace_members WHERE workspace_id=1 AND user_id=7")).rows[0];
    expect(row).toEqual({ role: 'editor', status: 'pending' });
    // replay accept / decline after accept
    signInAs(7);
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'accept' }), ctx({ id: '1' }))).status).toBe(200);
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'accept' }), ctx({ id: '1' }))).status).toBe(404);
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'decline' }), ctx({ id: '1' }))).status).toBe(404);
  });

  it('remove revokes immediately; re-add needs consent again', async () => {
    signInAs(2);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(200);

    signInAs(1);
    expect((await memberDelete(new Request('http://x/api/workspaces/1/members/2', { method: 'DELETE' }), ctx({ id: '1', userId: '2' }))).status).toBe(200);
    signInAs(2);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(404);

    signInAs(1);
    expect((await membersPost(jsonReq('http://x/api/workspaces/1/members', 'POST', { email: 'a2@t.dev' }), ctx({ id: '1' }))).status).toBe(201);
    signInAs(2);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(404); // pending
    expect((await inviteAction(jsonReq('http://x/api/invitations/1', 'POST', { action: 'accept' }), ctx({ id: '1' }))).status).toBe(200);
    expect((await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).status).toBe(200);
  });

  it('membership table equals exactly the expected set', async () => {
    const rows = (await pool.query('SELECT workspace_id, user_id FROM workspace_members WHERE status = $1', ['accepted'])).rows
      .map((r) => [Number(r.workspace_id), Number(r.user_id)]);
    const expected: Array<[number, number]> = [];
    for (const [userId, wss] of Object.entries(VISIBLE)) {
      if (Number(userId) === 1 || Number(userId) === 5) continue; // owners are not rows
      for (const ws of wss) expected.push([ws, Number(userId)]);
    }
    expect(rows.sort((a, b) => a[0] - b[0] || a[1] - b[1])).toEqual(expected.sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  });
});
