import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { editMessageInputSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, MessageRow, MessageView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) return Response.json({ error: "not found" }, { status: 404 });

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

  const parsed = editMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { content } = parsed.data;
  const userId = session.user_id;

  const existing = await sql<MessageRow[]>`
    SELECT * FROM messages WHERE id = ${messageId}
  `;
  const msg = existing[0];
  if (!msg || msg.deleted_at !== null) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (msg.user_id !== userId) {
    return Response.json({ error: "not your message" }, { status: 403 });
  }

  const updated = await sql<MessageRow[]>`
    UPDATE messages SET content = ${content}, edited_at = NOW()
    WHERE id = ${messageId}
    RETURNING *
  `;
  const row = updated[0]!;

  const userRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${userId}
  `;
  const username = userRows[0]!.username;

  const view: MessageView = {
    id: row.id,
    roomId: row.room_id,
    dmId: row.dm_id,
    userId: row.user_id,
    username,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    deletedAt: null,
  };

  const roomId = row.room_id!;
  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  broadcast(
    memberIds.map((m) => m.user_id),
    {
      type: "MESSAGE_EDITED",
      payload: { roomId, messageId, content: row.content, editedAt: view.editedAt! },
      timestamp: Date.now(),
    },
  );

  return Response.json({ message: view });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) return Response.json({ error: "not found" }, { status: 404 });

  const userId = session.user_id;

  const existing = await sql<MessageRow[]>`
    SELECT * FROM messages WHERE id = ${messageId}
  `;
  const msg = existing[0];
  if (!msg || msg.deleted_at !== null) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (msg.user_id !== userId) {
    return Response.json({ error: "not your message" }, { status: 403 });
  }

  await sql<MessageRow[]>`
    UPDATE messages SET deleted_at = NOW()
    WHERE id = ${messageId}
    RETURNING *
  `;

  const roomId = msg.room_id!;
  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;
  broadcast(
    memberIds.map((m) => m.user_id),
    { type: "MESSAGE_DELETED", payload: { roomId, messageId }, timestamp: Date.now() },
  );

  return Response.json({ ok: true });
}
