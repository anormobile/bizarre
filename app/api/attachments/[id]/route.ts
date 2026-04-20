import { readFile } from "fs/promises";
import path from "path";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { attachmentIdParamSchema } from "@/lib/schemas";
import type { SessionRow, DmRow } from "@/lib/types";

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

function percentEncode(name: string): string {
  return encodeURIComponent(name).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rawParams = await params;
  const paramParsed = attachmentIdParamSchema.safeParse(rawParams);
  if (!paramParsed.success) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const attachmentId = paramParsed.data.id;

  const attRows = await sql<{
    id: number;
    message_id: number;
    original_name: string;
    storage_path: string;
    mime: string;
    size_bytes: number;
    created_at: Date;
    room_id: number | null;
    dm_id: number | null;
    deleted_at: Date | null;
  }[]>`
    SELECT a.id, a.message_id, a.original_name, a.storage_path, a.mime, a.size_bytes, a.created_at,
           m.room_id, m.dm_id, m.deleted_at
    FROM attachments a
    JOIN messages m ON m.id = a.message_id
    WHERE a.id = ${attachmentId}
  `;

  const att = attRows[0];
  if (!att || att.deleted_at !== null) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const callerId = session.user_id;

  if (att.room_id !== null) {
    const rooms = await sql<{ id: number; deleted_at: Date | null }[]>`
      SELECT id, deleted_at FROM rooms WHERE id = ${att.room_id}
    `;
    const room = rooms[0];
    if (!room || room.deleted_at !== null) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const bans = await sql<{ user_id: string }[]>`
      SELECT user_id FROM room_bans WHERE room_id = ${att.room_id} AND user_id = ${callerId}
    `;
    if (bans.length > 0) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const membership = await sql<{ user_id: string }[]>`
      SELECT user_id FROM room_members WHERE room_id = ${att.room_id} AND user_id = ${callerId}
    `;
    if (membership.length === 0) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (att.dm_id !== null) {
    const dmRows = await sql<DmRow[]>`
      SELECT id, user_a, user_b, created_at FROM dms WHERE id = ${att.dm_id}
    `;
    const dm = dmRows[0];
    if (!dm) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (dm.user_a !== callerId && dm.user_b !== callerId) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    const otherUserId = dm.user_a === callerId ? dm.user_b : dm.user_a;
    if (!(await isConfirmedFriend(callerId, otherUserId))) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const fullPath = path.join(FILES_ROOT, att.storage_path);
  let fileBytes: Uint8Array;
  try {
    fileBytes = await readFile(fullPath);
  } catch {
    return Response.json({ error: "storage missing" }, { status: 500 });
  }

  const isImage = att.mime.startsWith("image/");
  const disposition = isImage ? "inline" : "attachment";
  const encoded = percentEncode(att.original_name);
  const contentDisposition = `${disposition}; filename="${att.original_name.replace(/"/g, '\\"')}"; filename*=UTF-8''${encoded}`;

  const body = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(att.size_bytes),
      "Content-Disposition": contentDisposition,
    },
  });
}
