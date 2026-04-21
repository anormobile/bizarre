import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { roomMemberPathSchema, roomMemberRoleSchema } from "@/lib/schemas";
import { broadcast, removeUserFromRoomFanout } from "@/lib/websocket";
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const raw = await params;
  const parsed = roomMemberPathSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { id: roomId, userId: targetUserId } = parsed.data;
  const caller = session.user_id;

  if (caller === targetUserId) {
    return Response.json({ error: "cannot ban self" }, { status: 400 });
  }

  const callerRole = await getRoomRole(roomId, caller);
  if (!callerRole || callerRole === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const targetRole = await getRoomRole(roomId, targetUserId);
  if (!targetRole) {
    return Response.json({ error: "not a member" }, { status: 404 });
  }

  if (callerRole === "admin" && (targetRole === "owner" || targetRole === "admin")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO room_bans (room_id, user_id, banned_by)
      VALUES (${roomId}, ${targetUserId}, ${caller})
      ON CONFLICT DO NOTHING
    `;
    await tx`
      DELETE FROM room_members
      WHERE room_id = ${roomId} AND user_id = ${targetUserId}
    `;
  });

  const remainingRows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  const remainingMemberIds = remainingRows.map((m) => m.user_id);

  broadcast(remainingMemberIds, {
    type: "MEMBER_LEFT",
    payload: { roomId, userId: targetUserId, reason: "banned" as const },
    timestamp: Date.now(),
  });

  broadcast([targetUserId], {
    type: "USER_BAN_NOTIFY",
    payload: { roomId },
    timestamp: Date.now(),
  });

  removeUserFromRoomFanout(roomId, targetUserId);

  return Response.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const raw = await params;
  const parsed = roomMemberPathSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  const bodyParsed = roomMemberRoleSchema.safeParse(body);
  if (!bodyParsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { id: roomId, userId: targetUserId } = parsed.data;
  const newRole = bodyParsed.data.role;
  const caller = session.user_id;

  const callerRole = await getRoomRole(roomId, caller);
  if (!callerRole || callerRole === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const targetRole = await getRoomRole(roomId, targetUserId);
  if (!targetRole) {
    return Response.json({ error: "not a member" }, { status: 404 });
  }

  if (targetRole === "owner") {
    return Response.json({ error: "cannot change owner" }, { status: 403 });
  }

  if (callerRole === "admin" && caller === targetUserId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (targetRole === newRole) {
    return Response.json({ error: "no change" }, { status: 400 });
  }

  await sql`
    UPDATE room_members SET role = ${newRole}
    WHERE room_id = ${roomId} AND user_id = ${targetUserId}
  `;

  const memberRows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  const memberIds = memberRows.map((m) => m.user_id);

  broadcast(memberIds, {
    type: "ROOM_MEMBER_ROLE_CHANGED",
    payload: { roomId, userId: targetUserId, role: newRole },
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
