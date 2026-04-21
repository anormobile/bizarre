import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { dmPathParamSchema, listDmMessagesQuerySchema } from "@/lib/schemas";
import type { SessionRow, MessageView, AttachmentView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

async function isConfirmedFriend(me: string, other: string): Promise<boolean> {
  if (me === other) return false;
  const [a, b] = [me, other].sort();
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM friendships
    WHERE user_a = ${a} AND user_b = ${b} AND status = 'confirmed'
  `;
  return rows.length > 0;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rawParams = await params;
  const paramParsed = dmPathParamSchema.safeParse(rawParams);
  if (!paramParsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const otherUserId = paramParsed.data.userId;
  const me = session.user_id;

  if (!(await isConfirmedFriend(me, otherUserId))) {
    return Response.json({ error: "not friends" }, { status: 403 });
  }

  const url = new URL(request.url);
  const queryParsed = listDmMessagesQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!queryParsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { before, limit } = queryParsed.data;

  const [a, b] = [me, otherUserId].sort();
  const dmRows = await sql<{ id: number }[]>`
    SELECT id FROM dms WHERE user_a = ${a} AND user_b = ${b}
  `;
  if (dmRows.length === 0) {
    return Response.json({ messages: [], nextCursor: null });
  }
  const dmId = dmRows[0]!.id;

  let msgRows: { id: number; dm_id: number | null; room_id: number | null; user_id: string; username: string; content: string; reply_to_id: number | null; created_at: Date; edited_at: Date | null; deleted_at: Date | null }[];

  if (before !== undefined) {
    msgRows = await sql<typeof msgRows>`
      SELECT m.id, m.dm_id, m.room_id, m.user_id, u.username, m.content, m.reply_to_id, m.created_at, m.edited_at, m.deleted_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.dm_id = ${dmId} AND m.deleted_at IS NULL AND m.id < ${before}
      ORDER BY m.id DESC
      LIMIT ${limit}
    `;
  } else {
    msgRows = await sql<typeof msgRows>`
      SELECT m.id, m.dm_id, m.room_id, m.user_id, u.username, m.content, m.reply_to_id, m.created_at, m.edited_at, m.deleted_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.dm_id = ${dmId} AND m.deleted_at IS NULL
      ORDER BY m.id DESC
      LIMIT ${limit}
    `;
  }

  const messageIds = msgRows.map((r) => r.id);
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

  const replyIds = msgRows.map((r) => r.reply_to_id).filter((id): id is number => id !== null);
  const replyMap = new Map<number, import("@/lib/types").ReplyToView>();
  if (replyIds.length > 0) {
    const replyRows = await sql<{ id: number; content: string; username: string }[]>`
      SELECT m.id, m.content, u.username
      FROM messages m JOIN users u ON u.id = m.user_id
      WHERE m.id = ANY(${replyIds})
    `;
    for (const r of replyRows) {
      replyMap.set(r.id, { id: r.id, content: r.content, username: r.username });
    }
  }

  const messages: MessageView[] = msgRows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    dmId: r.dm_id,
    userId: r.user_id,
    username: r.username,
    content: r.content,
    createdAt: r.created_at.toISOString(),
    editedAt: r.edited_at ? r.edited_at.toISOString() : null,
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    attachments: attachmentsByMessage.get(r.id) ?? [],
    replyToId: r.reply_to_id,
    replyTo: r.reply_to_id ? (replyMap.get(r.reply_to_id) ?? null) : null,
  }));

  const nextCursor = messages.length === limit ? messages[messages.length - 1]!.id : null;

  return Response.json({ messages, nextCursor });
}
