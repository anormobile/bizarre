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
  if (!rooms[0]) return Response.json({ error: "not found" }, { status: 404 });

  const userId = session.user_id;
  const membership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (membership.length === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (membership[0]!.role === "owner") {
    return Response.json({ error: "owner must delete" }, { status: 403 });
  }

  const priorMembers = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;

  await sql`
    DELETE FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;

  broadcast(
    priorMembers.map((m) => m.user_id),
    {
      type: "MEMBER_LEFT",
      payload: { roomId, userId, reason: "leave" as const },
      timestamp: Date.now(),
    },
  );

  return Response.json({ ok: true });
}
