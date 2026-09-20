import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";
import { getSessionUserId, unauthorized, badRequest, notFound } from "@/lib/api";
import { isValidEmail, normalizeEmail, parsePositiveInt } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaceId = parsePositiveInt((await context.params).id);
  if (!workspaceId || !(await getOwnedWorkspaceById(userId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  const dataSource = await getDataSource();
  const members = await dataSource.query(
    `
      SELECT u.id, u.email, wm.role, wm.status, wm.created_at
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1
      ORDER BY u.email ASC
    `,
    [workspaceId]
  );

  return NextResponse.json({ members });
}

export async function POST(request: Request, context: RouteContext) {
  const ownerId = await getSessionUserId();
  if (!ownerId) {
    return unauthorized();
  }

  const workspaceId = parsePositiveInt((await context.params).id);
  if (!workspaceId || !(await getOwnedWorkspaceById(ownerId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return badRequest("A valid email is required");
  }

  const dataSource = await getDataSource();
  const userRows = await dataSource.query(
    `SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email]
  );

  const member = userRows[0];
  if (!member) {
    return notFound("User not found");
  }
  if (member.id === ownerId) {
    return badRequest("Cannot add yourself as a collaborator");
  }

  const rows = await dataSource.query(
    `
      INSERT INTO workspace_members (workspace_id, user_id, role, status)
      VALUES ($1, $2, 'editor', 'pending')
      ON CONFLICT (workspace_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING workspace_id, user_id, role, status, created_at
    `,
    [workspaceId, member.id]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
