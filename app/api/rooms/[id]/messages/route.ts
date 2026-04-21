import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { listMessagesQuerySchema } from "@/lib/schemas";
import type { SessionRow, RoomRow, MessageView, AttachmentView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

interface MessageJoinRow {
  id: number;
  room_id: number | null;
  dm_id: number | null;
  user_id: string;
  content: string;
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  username: string;
}

export async function GET(
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
    FROM rooms WHERE id = ${roomId}
  `;
  const room = rooms[0];
  if (!room || room.deleted_at !== null) {
    return Response.json({ error: "room not found" }, { status: 404 });
  }

  const userId = session.user_id;
  const membership = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (membership.length === 0) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const parsed = listMessagesQuerySchema.safeParse(query);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { before, limit } = parsed.data;
  const beforeVal = before ?? null;

  const rows = await sql<MessageJoinRow[]>`
    SELECT m.id, m.room_id, m.dm_id, m.user_id, m.content, m.edited_at, m.deleted_at, m.created_at, u.username
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.room_id = ${roomId}
      AND (${beforeVal}::bigint IS NULL OR m.id < ${beforeVal})
    ORDER BY m.id DESC
    LIMIT ${limit}
  `;

  const messageIds = rows.map((r) => r.id);
  let attachmentsByMessage = new Map<number, AttachmentView[]>();
  if (messageIds.length > 0) {
    const attRows = await sql<{ id: number; message_id: number; original_name: string; mime: string; size_bytes: number; created_at: Date }[]>`
      SELECT id, message_id, original_name, mime, size_bytes, created_at
      FROM attachments WHERE message_id = ANY(${messageIds})
    `;
    for (const a of attRows) {
      const list = attachmentsByMessage.get(a.message_id) ?? [];
      list.push({
        id: a.id,
        messageId: a.message_id,
        originalName: a.original_name,
        mime: a.mime,
        sizeBytes: Number(a.size_bytes),
        createdAt: a.created_at.toISOString(),
      });
      attachmentsByMessage.set(a.message_id, list);
    }
  }

  const messages: MessageView[] = rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    dmId: r.dm_id,
    userId: r.user_id,
    username: r.username,
    content: r.deleted_at ? "" : r.content,
    createdAt: r.created_at.toISOString(),
    editedAt: r.edited_at ? r.edited_at.toISOString() : null,
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    attachments: attachmentsByMessage.get(r.id) ?? [],
  }));

  const nextCursor = rows.length === limit ? rows[rows.length - 1]!.id : null;

  return Response.json({ messages, nextCursor });
}
