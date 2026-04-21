import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import type { SessionRow } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function GET() {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await sql<{
    id: number;
    room_id: number;
    room_name: string;
    invited_by_username: string;
    created_at: Date;
  }[]>`
    SELECT ri.id, ri.room_id, r.name AS room_name, u.username AS invited_by_username, ri.created_at
    FROM room_invitations ri
    JOIN rooms r ON r.id = ri.room_id
    JOIN users u ON u.id = ri.invited_by
    WHERE ri.invited_user = ${session.user_id}
      AND ri.status = 'pending'
      AND r.deleted_at IS NULL
    ORDER BY ri.created_at DESC
  `;

  const invitations = rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    roomName: r.room_name,
    invitedByUsername: r.invited_by_username,
    createdAt: r.created_at.toISOString(),
  }));

  return Response.json({ invitations });
}
