import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataSource } from "@/lib/typeorm";
import { getWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const getWorkspaceId = async (context: RouteContext) => {
  const params = await context.params;
  const workspaceId = Number(params.id);

  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return null;
  }

  return workspaceId;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getWorkspaceById(userId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  const { name } = await request.json();
  const normalizedName = String(name ?? "").trim();
  if (!normalizedName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      UPDATE workspaces
      SET name = $3, updated_at = now()
      WHERE user_id = $1 AND id = $2 AND archived_at IS NULL
      RETURNING id, user_id, name, archived_at, created_at, updated_at
    `,
    [userId, workspaceId, normalizedName]
  );

  return NextResponse.json(rows[0]);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getWorkspaceById(userId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      UPDATE workspaces
      SET archived_at = now(), updated_at = now()
      WHERE user_id = $1 AND id = $2 AND archived_at IS NULL
      RETURNING id, user_id, name, archived_at, created_at, updated_at
    `,
    [userId, workspaceId]
  );

  return NextResponse.json(rows[0]);
}
