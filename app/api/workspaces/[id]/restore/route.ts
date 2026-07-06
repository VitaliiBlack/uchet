import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataSource } from "@/lib/typeorm";
import { getWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const userId = Number(session.user.id);
  const workspaceId = Number(params.id);

  if (
    !Number.isInteger(workspaceId) ||
    workspaceId <= 0 ||
    !(await getWorkspaceById(userId, workspaceId, true))
  ) {
    return workspaceNotFoundResponse();
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      UPDATE workspaces
      SET archived_at = NULL, updated_at = now()
      WHERE user_id = $1 AND id = $2
      RETURNING id, user_id, name, archived_at, created_at, updated_at
    `,
    [userId, workspaceId]
  );

  return NextResponse.json(rows[0]);
}
