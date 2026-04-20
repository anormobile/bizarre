import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMessageInputSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, MessageRow, MessageView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function POST(request: Request) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  if (typeof body === "object" && body !== null && "content" in body) {
    (body as Record<string, unknown>).content =
      typeof (body as Record<string, unknown>).content === "string"
        ? ((body as Record<string, unknown>).content as string).trim()
        : (body as Record<string, unknown>).content;
  }

  const parsed = sendMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { roomId, content } = parsed.data;
  const userId = session.user_id;

  const rooms = await sql<RoomRow[]>`
    SELECT id, name, description, visibility, owner_id, created_at, deleted_at
    FROM rooms WHERE id = ${roomId}
  `;
  const room = rooms[0];
  if (!room || room.deleted_at !== null) {
    return Response.json({ error: "room not found" }, { status: 404 });
  }

  const membership = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (membership.length === 0) {
    return Response.json({ error: "not a member" }, { status: 403 });
  }

  const inserted = await sql<MessageRow[]>`
    INSERT INTO messages (room_id, user_id, content)
    VALUES (${roomId}, ${userId}, ${content})
    RETURNING *
  `;
  const msg = inserted[0]!;

  const userRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${userId}
  `;
  const username = userRows[0]!.username;

  const view: MessageView = {
    id: msg.id,
    roomId: msg.room_id,
    dmId: msg.dm_id,
    userId: msg.user_id,
    username,
    content: msg.content,
    createdAt: msg.created_at.toISOString(),
    editedAt: null,
    deletedAt: null,
  };

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  broadcast(
    memberIds.map((m) => m.user_id),
    { type: "MESSAGE_NEW", payload: { roomId, message: view }, timestamp: Date.now() },
  );

  return Response.json({ message: view }, { status: 201 });
}
