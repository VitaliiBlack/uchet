import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";

export interface WorkspaceRow {
  id: number;
  user_id: number;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  access_role: "owner" | "editor";
  is_owner: boolean;
}

const normalizeWorkspace = (row: Record<string, unknown>): WorkspaceRow => ({
  id: Number(row.id),
  user_id: Number(row.user_id),
  name: String(row.name),
  archived_at: row.archived_at ? String(row.archived_at) : null,
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
  access_role: row.access_role === "editor" ? "editor" : "owner",
  is_owner: Boolean(row.is_owner),
});

export const getActiveWorkspaces = async (userId: number) => {
  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      SELECT
        w.id,
        w.user_id,
        w.name,
        w.archived_at,
        w.created_at,
        w.updated_at,
        'owner' AS access_role,
        true AS is_owner
      FROM workspaces w
      WHERE w.user_id = $1 AND w.archived_at IS NULL
      UNION ALL
      SELECT
        w.id,
        w.user_id,
        w.name,
        w.archived_at,
        w.created_at,
        w.updated_at,
        wm.role AS access_role,
        false AS is_owner
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
        AND w.archived_at IS NULL
        AND w.user_id <> $1
      ORDER BY id ASC
    `,
    [userId]
  );

  return rows.map(normalizeWorkspace);
};

export const getWorkspaceById = async (
  userId: number,
  workspaceId: number,
  includeArchived = false
) => {
  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      SELECT
        w.id,
        w.user_id,
        w.name,
        w.archived_at,
        w.created_at,
        w.updated_at,
        CASE WHEN w.user_id = $1 THEN 'owner' ELSE wm.role END AS access_role,
        (w.user_id = $1) AS is_owner
      FROM workspaces w
      LEFT JOIN workspace_members wm
        ON wm.workspace_id = w.id AND wm.user_id = $1
      WHERE w.id = $2
        AND (w.user_id = $1 OR wm.user_id = $1)
        AND ($3::boolean OR w.archived_at IS NULL)
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
    return (await getActiveWorkspaces(userId))[0]?.id ?? null;
  }

  const parsed = Number(workspaceId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  const workspace = await getWorkspaceById(userId, parsed);
  return workspace?.id ?? null;
};

export const getOwnedWorkspaceById = async (
  userId: number,
  workspaceId: number,
  includeArchived = false
) => {
  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    `
      SELECT
        id,
        user_id,
        name,
        archived_at,
        created_at,
        updated_at,
        'owner' AS access_role,
        true AS is_owner
      FROM workspaces
      WHERE user_id = $1 AND id = $2
        AND ($3::boolean OR archived_at IS NULL)
      LIMIT 1
    `,
    [userId, workspaceId, includeArchived]
  );

  return rows[0] ? normalizeWorkspace(rows[0]) : null;
};

export const workspaceNotFoundResponse = () =>
  NextResponse.json(
    { error: "Workspace not found or access denied" },
    { status: 404 }
  );
