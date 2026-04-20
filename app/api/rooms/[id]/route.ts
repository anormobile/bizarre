import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, RoomMemberRow, RoomSummary } from "@/lib/types";

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
  const isMember = membership.length > 0;

  if (room.visibility === "private" && !isMember) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const memberCount = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM room_members WHERE room_id = ${roomId}
  `;

  const members = await sql<{ userId: string; username: string; role: string }[]>`
    SELECT rm.user_id AS "userId", u.username, rm.role
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ${roomId}
  `;

  const summary: RoomSummary = {
    id: room.id,
    name: room.name,
    description: room.description,
    visibility: room.visibility,
    ownerId: room.owner_id,
    memberCount: memberCount[0]!.count,
    joinedAt: isMember ? membership[0]!.joined_at.toISOString() : undefined,
  };

  return Response.json({ room: summary, members });
}

export async function DELETE(
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
  if (membership.length === 0 || membership[0]!.role !== "owner") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;

  await sql`UPDATE rooms SET deleted_at = NOW() WHERE id = ${roomId}`;

  broadcast(
    memberIds.map((m) => m.user_id),
    { type: "ROOM_DELETED", payload: { roomId }, timestamp: Date.now() },
  );

  return Response.json({ ok: true });
}
