import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, RoomMemberRow } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function POST(
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

  if (room.visibility === "private") {
    return Response.json({ error: "private room" }, { status: 403 });
  }

  const userId = session.user_id;

  const banned = await sql<{ room_id: number }[]>`
    SELECT room_id FROM room_bans WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (banned.length > 0) {
    return Response.json({ error: "banned" }, { status: 403 });
  }

  const existing = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (existing.length > 0) {
    return Response.json({ error: "already a member" }, { status: 409 });
  }

  await sql`
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (${roomId}, ${userId}, 'member')
  `;

  const userRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${userId}
  `;
  const username = userRows[0]!.username;

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  const allIds = memberIds.map((m) => m.user_id);

  broadcast(allIds, {
    type: "MEMBER_JOINED",
    payload: { roomId, userId, username, role: "member" as const },
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
