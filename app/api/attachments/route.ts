import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { uploadAttachmentFieldsSchema, MAX_ATTACHMENT_BYTES, MAX_IMAGE_BYTES } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, DmRow, MessageRow, MessageView, AttachmentView } from "@/lib/types";

const FILES_ROOT = process.env.FILES_ROOT ?? "/app/files";

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

async function getOrCreateDm(me: string, other: string): Promise<{ id: number }> {
  const [a, b] = [me, other].sort();
  const existing = await sql<{ id: number }[]>`
    SELECT id FROM dms WHERE user_a = ${a} AND user_b = ${b}
  `;
  if (existing.length > 0) return existing[0]!;
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO dms (user_a, user_b) VALUES (${a}, ${b}) RETURNING id
  `;
  return inserted[0]!;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
}

export async function POST(request: Request) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return Response.json({ error: "file too large" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (mime.startsWith("image/") && file.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: "image too large" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  const contentVal = formData.get("content");
  if (contentVal !== null) fields.content = String(contentVal);
  const roomIdVal = formData.get("roomId");
  if (roomIdVal !== null) fields.roomId = String(roomIdVal);
  const dmIdVal = formData.get("dmId");
  if (dmIdVal !== null) fields.dmId = String(dmIdVal);
  const userIdVal = formData.get("userId");
  if (userIdVal !== null) fields.userId = String(userIdVal);

  const parsed = uploadAttachmentFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { content, roomId, dmId: bodyDmId, userId: bodyUserId } = parsed.data;
  const callerId = session.user_id;

  let resolvedRoomId: number | undefined;
  let resolvedDmId: number | undefined;
  let broadcastTargets: string[];

  if (roomId) {
    const rooms = await sql<RoomRow[]>`
      SELECT id, name, description, visibility, owner_id, created_at, deleted_at
      FROM rooms WHERE id = ${roomId}
    `;
    const room = rooms[0];
    if (!room || room.deleted_at !== null) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const bans = await sql<{ user_id: string }[]>`
      SELECT user_id FROM room_bans WHERE room_id = ${roomId} AND user_id = ${callerId}
    `;
    if (bans.length > 0) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const membership = await sql<{ user_id: string }[]>`
      SELECT user_id FROM room_members WHERE room_id = ${roomId} AND user_id = ${callerId}
    `;
    if (membership.length === 0) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    resolvedRoomId = roomId;
    const memberIds = await sql<{ user_id: string }[]>`
      SELECT user_id FROM room_members WHERE room_id = ${roomId}
    `;
    broadcastTargets = memberIds.map((m) => m.user_id);
  } else {
    let dmId: number;
    let otherUserId: string;

    if (bodyDmId) {
      const dmRows = await sql<DmRow[]>`
        SELECT id, user_a, user_b, created_at FROM dms WHERE id = ${bodyDmId}
      `;
      const dm = dmRows[0];
      if (!dm) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      if (dm.user_a !== callerId && dm.user_b !== callerId) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      otherUserId = dm.user_a === callerId ? dm.user_b : dm.user_a;
      if (!(await isConfirmedFriend(callerId, otherUserId))) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      dmId = dm.id;
    } else {
      otherUserId = bodyUserId!;
      if (!(await isConfirmedFriend(callerId, otherUserId))) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const dm = await getOrCreateDm(callerId, otherUserId);
      dmId = dm.id;
    }

    resolvedDmId = dmId;
    broadcastTargets = [callerId, otherUserId];
  }

  const userRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${callerId}
  `;
  const username = userRows[0]!.username;

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const sanitizedName = sanitizeFilename(file.name);

  let messageRow: MessageRow;
  let attachmentRow: { id: number; message_id: number; original_name: string; mime: string; size_bytes: number; created_at: Date };
  let storagePath: string;

  try {
    await sql.begin(async (tx) => {
      if (resolvedRoomId) {
        const msgs = await tx<MessageRow[]>`
          INSERT INTO messages (room_id, user_id, content)
          VALUES (${resolvedRoomId}, ${callerId}, ${content})
          RETURNING *
        `;
        messageRow = msgs[0]!;
      } else {
        const msgs = await tx<MessageRow[]>`
          INSERT INTO messages (dm_id, user_id, content)
          VALUES (${resolvedDmId!}, ${callerId}, ${content})
          RETURNING *
        `;
        messageRow = msgs[0]!;
      }

      const attRows = await tx<{ id: number; message_id: number; original_name: string; mime: string; size_bytes: number; created_at: Date }[]>`
        INSERT INTO attachments (message_id, uploader_id, original_name, storage_path, mime, size_bytes)
        VALUES (${messageRow!.id}, ${callerId}, ${file.name}, 'pending', ${mime}, ${file.size})
        RETURNING id, message_id, original_name, mime, size_bytes, created_at
      `;
      attachmentRow = attRows[0]!;

      storagePath = `attachments/${attachmentRow.id}-${sanitizedName}`;
      await tx`UPDATE attachments SET storage_path = ${storagePath} WHERE id = ${attachmentRow.id}`;

      const fullPath = path.join(FILES_ROOT, storagePath);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, fileBuffer);
    });
  } catch (err) {
    if (storagePath!) {
      try { await unlink(path.join(FILES_ROOT, storagePath!)); } catch {}
    }
    console.error("attachment upload failed:", err);
    return Response.json({ error: "storage failed" }, { status: 500 });
  }

  const attachmentView: AttachmentView = {
    id: attachmentRow!.id,
    messageId: attachmentRow!.message_id,
    originalName: attachmentRow!.original_name,
    mime: attachmentRow!.mime,
    sizeBytes: Number(attachmentRow!.size_bytes),
    createdAt: attachmentRow!.created_at.toISOString(),
  };

  const view: MessageView = {
    id: messageRow!.id,
    roomId: messageRow!.room_id,
    dmId: messageRow!.dm_id,
    userId: messageRow!.user_id,
    username,
    content: messageRow!.content,
    createdAt: messageRow!.created_at.toISOString(),
    editedAt: null,
    deletedAt: null,
    attachments: [attachmentView],
  };

  if (resolvedRoomId) {
    broadcast(broadcastTargets, {
      type: "MESSAGE_NEW",
      payload: { roomId: resolvedRoomId, message: view },
      timestamp: Date.now(),
    });
  } else {
    broadcast(broadcastTargets, {
      type: "MESSAGE_NEW",
      payload: { dmId: resolvedDmId!, message: view },
      timestamp: Date.now(),
    });
  }

  return Response.json({ message: view }, { status: 201 });
}
