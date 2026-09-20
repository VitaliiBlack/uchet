import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/typeorm";
import { getSessionUserId, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

// Pending membership invitations for the current user.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  const dataSource = await getDataSource();
  const invitations = await dataSource.query(
    `
      SELECT
        w.id AS workspace_id,
        w.name AS workspace_name,
        u.email AS owner_email,
        wm.role,
        wm.created_at
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      JOIN users u ON u.id = w.user_id
      WHERE wm.user_id = $1
        AND wm.status = 'pending'
        AND w.archived_at IS NULL
      ORDER BY wm.created_at DESC
    `,
    [userId]
  );

  return NextResponse.json({ invitations });
}
