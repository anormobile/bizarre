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

async function getRoomRole(
  roomId: number,
  userId: string,
): Promise<'owner' | 'admin' | 'member' | null> {
  const rows = await sql<{ role: 'owner' | 'admin' | 'member' }[]>`
    SELECT role FROM room_members
    WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  return rows[0]?.role ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const callerRole = await getRoomRole(roomId, session.user_id);
  if (!callerRole || callerRole === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await sql<{
    user_id: string;
    username: string;
    banned_by: string | null;
    banned_by_username: string | null;
    banned_at: Date;
  }[]>`
    SELECT
      rb.user_id,
      u.username,
      rb.banned_by,
      bu.username AS banned_by_username,
      rb.banned_at
    FROM room_bans rb
    JOIN users u ON u.id = rb.user_id
    LEFT JOIN users bu ON bu.id = rb.banned_by
    WHERE rb.room_id = ${roomId}
    ORDER BY rb.banned_at DESC
  `;

  const bans = rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    bannedBy: r.banned_by,
    bannedByUsername: r.banned_by_username,
    bannedAt: new Date(r.banned_at).toISOString(),
  }));

  return Response.json({ bans });
}
