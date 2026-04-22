import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import type { SessionRow, RoomRow, RoomMemberRow, RoomMemberView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) return Response.json({ error: "not found" }, { status: 404 });

  const rooms = await sql<RoomRow[]>`
    SELECT id, name, description, visibility, owner_id, created_at, deleted_at
    FROM rooms WHERE id = ${roomId} AND deleted_at IS NULL
  `;
  const room = rooms[0];
  if (!room) return Response.json({ error: "not found" }, { status: 404 });

  const userId = session.user_id;
  const membership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;

  if (room.visibility === "private" && membership.length === 0) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = await sql<{ userId: string; username: string; role: string; status: string | null }[]>`
    SELECT
      rm.user_id AS "userId",
      u.username,
      rm.role,
      COALESCE(up.status, 'offline') AS status
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    LEFT JOIN user_presence up ON up.user_id = rm.user_id
    WHERE rm.room_id = ${roomId}
    ORDER BY u.username ASC
  `;

  const members: RoomMemberView[] = rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    role: r.role as RoomMemberView["role"],
    status: (r.status as RoomMemberView["status"]) ?? "offline",
  }));

  const pendingRows = await sql<{ userId: string; username: string }[]>`
    SELECT ri.invited_user AS "userId", u.username
    FROM room_invitations ri
    JOIN users u ON u.id = ri.invited_user
    WHERE ri.room_id = ${roomId} AND ri.status = 'pending'
    ORDER BY u.username ASC
  `;

  const pending: RoomMemberView[] = pendingRows.map((r) => ({
    userId: r.userId,
    username: r.username,
    role: "pending",
    status: "offline",
  }));

  return Response.json({ members: [...members, ...pending] });
}
