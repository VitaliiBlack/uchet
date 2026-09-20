import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

import { auth } from '@/lib/auth';
import { resetRateLimits } from '@/lib/rateLimit';
import { GET as opsGet, PUT as opsPut, DELETE as opsDelete } from '@/app/api/financial-data/route';

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

// users: a=1, b=2, c=3. workspaces: ws1(a), ws2(a), ws3(b), ws4(c).
// b is an accepted member of ws1. c has no shares.
const VISIBLE: Record<number, number[]> = { 1: [1, 2], 2: [1, 3], 3: [4] };
const SECRETS: Record<number, string> = {
  1: 'SEC_A1', 2: 'SEC_A2', 3: 'SEC_B1', 4: 'SEC_C1',
};

const seed = async () => {
  await pool.query('TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE');
  await pool.query(
    "INSERT INTO users (email, password) VALUES ('a@t.dev','x'),('b@t.dev','x'),('c@t.dev','x')"
  );
  await pool.query(
    "INSERT INTO workspaces (user_id, name) VALUES (1,'A1'),(1,'A2'),(2,'B1'),(3,'C1')"
  );
  // b accepted in ws1 (legitimate share)
  await pool.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES (1,2,'editor','accepted')"
  );
  // ops: id 1..5
  await pool.query(
    "INSERT INTO financial_operations (user_id, workspace_id, date, income, expense, description) VALUES (1,1,'2026-09-01',10,0,'SEC_A1'),(2,1,'2026-09-02',20,0,'SHARED_B_IN_A1'),(1,2,'2026-09-01',30,0,'SEC_A2'),(2,3,'2026-09-01',40,0,'SEC_B1'),(3,4,'2026-09-01',50,0,'SEC_C1')"
  );
};

const opMeta = async () => {
  const rows = (await pool.query('SELECT id, workspace_id, description FROM financial_operations ORDER BY id')).rows;
  return rows.map((r) => ({ id: Number(r.id), ws: Number(r.workspace_id), desc: String(r.description) }));
};

describe('operation-id IDOR matrix (calendar table rows)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimits();
    await seed();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('PUT: no user can mutate any operation unless id AND workspace are both theirs', async () => {
    const ops = await opMeta();
    for (const uid of [1, 2, 3]) {
      const visible = new Set(VISIBLE[uid]);
      for (const op of ops) {
        for (let ws = 1; ws <= 4; ws++) {
          const allowed = visible.has(ws) && ws === op.ws;
          signInAs(uid);
          const r = await opsPut(
            jsonReq('http://x/api/financial-data', 'PUT', {
              id: op.id, income: 5, expense: 0, description: op.desc, workspaceId: ws,
            })
          );
          const label = 'u' + uid + ' op' + op.id + ' via ws' + ws;
          expect(r.status, label).toBe(allowed ? 200 : 404);
        }
      }
    }
    // foreign mutations never changed a description
    const after = await opMeta();
    for (const op of ops) {
      const row = after.find((a) => a.id === op.id);
      expect(row?.desc, 'op' + op.id + ' intact').toBe(op.desc);
    }
  });

  it('DELETE: no user can delete a foreign operation; only the right id+workspace pair', async () => {
    const ops = await opMeta();
    for (const uid of [1, 2, 3]) {
      const visible = new Set(VISIBLE[uid]);
      for (const op of ops) {
        for (let ws = 1; ws <= 4; ws++) {
          const allowed = visible.has(ws) && ws === op.ws;
          if (allowed) continue; // destructive; sanity-checked separately below
          signInAs(uid);
          const r = await opsDelete(
            new Request('http://x/api/financial-data?id=' + op.id + '&workspaceId=' + ws, { method: 'DELETE' })
          );
          expect(r.status, 'u' + uid + ' delete op' + op.id + ' via ws' + ws).toBe(404);
        }
      }
    }
    // integrity: nothing foreign was deleted
    expect((await opMeta()).length).toBe(ops.length);
    // sanity: owner CAN delete own op in own workspace
    signInAs(1);
    expect(
      (await opsDelete(new Request('http://x/api/financial-data?id=1&workspaceId=1', { method: 'DELETE' }))).status
    ).toBe(200);
    expect((await opMeta()).map((o) => o.id)).not.toContain(1);
  });

  it('secret scan: a member sees shared rows but never a foreign group secret', async () => {
    // b (member of ws1) sees both A1 secrets AND their own row in ws1, but not A2/B/C-only
    signInAs(2);
    const b1 = await (await opsGet(new Request('http://x/api/financial-data?workspaceId=1'))).text();
    expect(b1).toContain('SEC_A1');
    expect(b1).toContain('SHARED_B_IN_A1');
    expect(b1).not.toContain('SEC_A2');

    // c sees nothing but its own secret; never A or B secrets
    for (const uid of [1, 2, 3]) {
      const visible = new Set(VISIBLE[uid]);
      for (let ws = 1; ws <= 4; ws++) {
        signInAs(uid);
        const body = await (await opsGet(new Request('http://x/api/financial-data?workspaceId=' + ws))).text();
        for (const [secretWs, secret] of Object.entries(SECRETS)) {
          if (visible.has(Number(secretWs))) continue;
          expect(body.includes(secret), 'u' + uid + ' leaked ' + secret + ' via ws' + ws).toBe(false);
        }
      }
    }
  });
});
