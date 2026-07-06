import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDataSource } from "@/lib/typeorm";
import { getActiveWorkspaces } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { name } = await request.json();
  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
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
