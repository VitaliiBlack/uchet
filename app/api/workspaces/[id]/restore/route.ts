import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";
import { getSessionUserId, unauthorized } from "@/lib/api";
import { parsePositiveInt } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaceId = parsePositiveInt((await context.params).id);
  if (!workspaceId || !(await getOwnedWorkspaceById(userId, workspaceId, true))) {
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
