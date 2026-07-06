import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const ownerId = Number(session.user.id);
  const workspaceId = Number(params.id);
  const memberUserId = Number(params.userId);

  if (
    !Number.isInteger(workspaceId) ||
    workspaceId <= 0 ||
    !Number.isInteger(memberUserId) ||
    memberUserId <= 0 ||
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
