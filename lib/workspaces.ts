import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";

export const DEFAULT_WORKSPACE_NAME = "Магазин 1";

export interface WorkspaceRow {
  id: number;
  user_id: number;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const normalizeWorkspace = (row: Record<string, unknown>): WorkspaceRow => ({
  id: Number(row.id),
  user_id: Number(row.user_id),
  name: String(row.name),
  archived_at: row.archived_at ? String(row.archived_at) : null,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
});

export const getActiveWorkspaces = async (userId: number) => {
  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      SELECT id, user_id, name, archived_at, created_at, updated_at
      FROM workspaces
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY id ASC
    `,
    [userId]
  );

  return rows.map(normalizeWorkspace);
};

export const ensureDefaultWorkspace = async (userId: number) => {
  const dataSource = await getDataSource();
  const existing = await dataSource.query(
    `
      SELECT id, user_id, name, archived_at, created_at, updated_at
      FROM workspaces
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY id ASC
      LIMIT 1
    `,
    [userId]
  );

  if (existing[0]) {
    return normalizeWorkspace(existing[0]);
  }

  const created = await dataSource.query(
    `
      INSERT INTO workspaces (user_id, name)
      VALUES ($1, $2)
      RETURNING id, user_id, name, archived_at, created_at, updated_at
    `,
    [userId, DEFAULT_WORKSPACE_NAME]
  );

  return normalizeWorkspace(created[0]);
};

export const getWorkspaceById = async (
  userId: number,
  workspaceId: number,
  includeArchived = false
) => {
  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      SELECT id, user_id, name, archived_at, created_at, updated_at
      FROM workspaces
      WHERE user_id = $1 AND id = $2
        AND ($3::boolean OR archived_at IS NULL)
      LIMIT 1
    `,
    [userId, workspaceId, includeArchived]
  );

  return rows[0] ? normalizeWorkspace(rows[0]) : null;
};

export const resolveWorkspaceId = async (
  userId: number,
  workspaceId?: string | number | null
) => {
  if (!workspaceId) {
    return (await ensureDefaultWorkspace(userId)).id;
  }

  const parsed = Number(workspaceId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  const workspace = await getWorkspaceById(userId, parsed);
  return workspace?.id ?? null;
};

export const workspaceNotFoundResponse = () =>
  NextResponse.json(
    { error: "Workspace not found or access denied" },
    { status: 404 }
  );
