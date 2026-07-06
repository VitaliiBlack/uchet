import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const getWorkspaceId = async (context: RouteContext) => {
  const params = await context.params;
  const workspaceId = Number(params.id);
  return Number.isInteger(workspaceId) && workspaceId > 0 ? workspaceId : null;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getOwnedWorkspaceById(userId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  const dataSource = await getDataSource();
  const [members, availableUsers] = await Promise.all([
    dataSource.query(
      `
        SELECT u.id, u.email, wm.role, wm.created_at
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = $1
        ORDER BY u.email ASC
      `,
      [workspaceId]
    ),
    dataSource.query(
      `
        SELECT u.id, u.email
        FROM users u
        WHERE u.id <> $1
          AND NOT EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = $2 AND wm.user_id = u.id
          )
        ORDER BY u.email ASC
      `,
      [userId, workspaceId]
    ),
  ]);

  return NextResponse.json({ members, availableUsers });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = Number(session.user.id);
  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getOwnedWorkspaceById(ownerId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  const { userId } = await request.json();
  const memberUserId = Number(userId);
  if (!Number.isInteger(memberUserId) || memberUserId <= 0 || memberUserId === ownerId) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const dataSource = await getDataSource();
  const userRows = await dataSource.query(
    "SELECT id FROM users WHERE id = $1 LIMIT 1",
    [memberUserId]
  );
  if (!userRows[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rows = await dataSource.query(
    `
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'editor')
      ON CONFLICT (workspace_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING workspace_id, user_id, role, created_at
    `,
    [workspaceId, memberUserId]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
