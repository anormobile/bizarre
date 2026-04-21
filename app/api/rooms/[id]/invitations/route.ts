import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { inviteToRoomInputSchema } from "@/lib/schemas";
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
  request: Request,
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

  const callerMembership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${session.user_id}
  `;
  if (callerMembership.length === 0 || callerMembership[0]!.role === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = inviteToRoomInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { username } = parsed.data;

  const userRows = await sql<{ id: string; username: string }[]>`
    SELECT id, username FROM users WHERE username = ${username} AND deleted_at IS NULL
  `;
  if (userRows.length === 0) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }
  const invitedUser = userRows[0]!;

  const existingMember = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId} AND user_id = ${invitedUser.id}
  `;
  if (existingMember.length > 0) {
    return Response.json({ error: "already member" }, { status: 409 });
  }

  const existingInvite = await sql<{ id: number; status: string }[]>`
    SELECT id, status FROM room_invitations WHERE room_id = ${roomId} AND invited_user = ${invitedUser.id}
  `;
  if (existingInvite.length > 0 && existingInvite[0]!.status === "pending") {
    return Response.json({ error: "already invited" }, { status: 409 });
  }

  let insertedId: number;
  if (existingInvite.length > 0) {
    const updated = await sql<{ id: number }[]>`
      UPDATE room_invitations SET status = 'pending', invited_by = ${session.user_id}
      WHERE room_id = ${roomId} AND invited_user = ${invitedUser.id}
      RETURNING id
    `;
    insertedId = updated[0]!.id;
  } else {
    const inserted = await sql<{ id: number }[]>`
      INSERT INTO room_invitations (room_id, invited_user, invited_by)
      VALUES (${roomId}, ${invitedUser.id}, ${session.user_id})
      RETURNING id
    `;
    insertedId = inserted[0]!.id;
  }

  const callerRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${session.user_id}
  `;

  broadcast(
    [invitedUser.id],
    {
      type: "ROOM_INVITATION_RECEIVED",
      payload: {
        invitationId: insertedId,
        roomId,
        roomName: room.name,
        invitedBy: { userId: session.user_id, username: callerRows[0]!.username },
      },
      timestamp: Date.now(),
    },
  );

  return Response.json({
    invitation: { id: insertedId, roomId, roomName: room.name, status: "pending" },
  });
}
