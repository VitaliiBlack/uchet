import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";
import { getSessionUserId, unauthorized } from "@/lib/api";
import { parsePositiveInt } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ownerId = await getSessionUserId();
  if (!ownerId) {
    return unauthorized();
  }

  const params = await context.params;
  const workspaceId = parsePositiveInt(params.id);
  const memberUserId = parsePositiveInt(params.userId);

  if (
    !workspaceId ||
    !memberUserId ||
    !(await getOwnedWorkspaceById(ownerId, workspaceId))
  ) {
    return workspaceNotFoundResponse();
  }

  const dataSource = await getDataSource();
  await dataSource.query(
    `
      DELETE FROM workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `,
    [workspaceId, memberUserId]
  );

  return NextResponse.json({ success: true });
}
