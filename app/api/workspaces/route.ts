import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getActiveWorkspaces } from "@/lib/workspaces";
import { getSessionUserId, unauthorized, badRequest } from "@/lib/api";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 100;

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  const dataSource = await getDataSource();

  if (includeArchived) {
    const rows = await dataSource.query(
      `
        SELECT id, user_id, name, archived_at, created_at, updated_at
          , 'owner' AS access_role
          , true AS is_owner
        FROM workspaces
        WHERE user_id = $1
        ORDER BY archived_at NULLS FIRST, id ASC
      `,
      [userId]
    );
    return NextResponse.json(rows);
  }

  return NextResponse.json(await getActiveWorkspaces(userId));
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const normalizedName = String(body.name ?? "").replace(/\u0000/g, "").trim();
  if (!normalizedName) {
    return badRequest("Name is required");
  }
  if (normalizedName.length > MAX_NAME_LENGTH) {
    return badRequest("Name is too long");
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      INSERT INTO workspaces (user_id, name)
      VALUES ($1, $2)
      RETURNING id, user_id, name, archived_at, created_at, updated_at
    `,
    [userId, normalizedName]
  );

  return NextResponse.json(
    { ...rows[0], access_role: "owner", is_owner: true },
    { status: 201 }
  );
}
