import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { badRequest, getSessionUserId, notFound, unauthorized } from "@/lib/api";
import { parsePositiveInt } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Accept or decline a pending invitation for the current user.
export async function POST(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaceId = parsePositiveInt((await context.params).id);
  if (!workspaceId) {
    return notFound("Invitation not found");
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const action = body.action;
  if (action !== "accept" && action !== "decline") {
    return badRequest("action must be 'accept' or 'decline'");
  }

  const dataSource = await getDataSource();

  if (action === "accept") {
    const rows = await dataSource.query(
      `UPDATE workspace_members
         SET status = 'accepted'
         WHERE workspace_id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING workspace_id, user_id, role, status`,
      [workspaceId, userId]
    );
    if (!rows[0]) {
      return notFound("Invitation not found");
    }
    return NextResponse.json(rows[0]);
  }

  await dataSource.query(
    `DELETE FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'pending'`,
    [workspaceId, userId]
  );

  return NextResponse.json({ success: true });
}
