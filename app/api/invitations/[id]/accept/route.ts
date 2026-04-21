import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow } from "@/lib/types";

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
  const invitationId = Number(id);
  if (!Number.isFinite(invitationId)) return Response.json({ error: "not found" }, { status: 404 });

  const invRows = await sql<{ id: number; room_id: number; invited_user: string; status: string }[]>`
    SELECT id, room_id, invited_user, status FROM room_invitations WHERE id = ${invitationId}
  `;
  const inv = invRows[0];
  if (!inv) return Response.json({ error: "not found" }, { status: 404 });
  if (inv.invited_user !== session.user_id) return Response.json({ error: "forbidden" }, { status: 403 });
  if (inv.status !== "pending") return Response.json({ error: "not pending" }, { status: 400 });

  const rooms = await sql<RoomRow[]>`
    SELECT id, name, description, visibility, owner_id, created_at, deleted_at
    FROM rooms WHERE id = ${inv.room_id} AND deleted_at IS NULL
  `;
  const room = rooms[0];
  if (!room) return Response.json({ error: "room deleted" }, { status: 404 });

  const banCheck = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_bans WHERE room_id = ${inv.room_id} AND user_id = ${session.user_id}
  `;
  if (banCheck.length > 0) return Response.json({ error: "banned from room" }, { status: 403 });

  await sql.begin(async (tx) => {
    await tx`
      UPDATE room_invitations SET status = 'accepted' WHERE id = ${invitationId}
    `;
    await tx`
      INSERT INTO room_members (room_id, user_id, role)
      VALUES (${inv.room_id}, ${session.user_id}, 'member')
      ON CONFLICT DO NOTHING
    `;
  });

  const userRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${session.user_id}
  `;
  const username = userRows[0]!.username;

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${inv.room_id}
  `;

  broadcast(
    memberIds.map((m) => m.user_id),
    {
      type: "MEMBER_JOINED",
      payload: { roomId: inv.room_id, userId: session.user_id, username, role: "member" as const },
      timestamp: Date.now(),
    },
  );

  return Response.json({
    ok: true,
    room: {
      id: room.id,
      name: room.name,
      description: room.description,
      visibility: room.visibility,
    },
  });
}
