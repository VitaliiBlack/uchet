import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getOwnedWorkspaceById, workspaceNotFoundResponse } from "@/lib/workspaces";
import { getSessionUserId, unauthorized, badRequest } from "@/lib/api";
import { parsePositiveInt } from "@/lib/validation";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_NAME_LENGTH = 100;

const getWorkspaceId = async (context: RouteContext) =>
  parsePositiveInt((await context.params).id);

export async function PATCH(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getOwnedWorkspaceById(userId, workspaceId))) {
    return workspaceNotFoundResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const normalizedName = String(body.name ?? "").trim();
  if (!normalizedName) {
    return badRequest("Name is required");
  }
  if (normalizedName.length > MAX_NAME_LENGTH) {
    return badRequest("Name is too long");
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
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const workspaceId = await getWorkspaceId(context);
  if (!workspaceId || !(await getOwnedWorkspaceById(userId, workspaceId))) {
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
