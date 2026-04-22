import { unlink } from "node:fs/promises";
import path from "path";
import { z } from "zod";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, RoomMemberRow, RoomSummary } from "@/lib/types";

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

export async function GET(
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
  const room = rooms[0];
  if (!room) return Response.json({ error: "not found" }, { status: 404 });

  const userId = session.user_id;
  const membership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  const isMember = membership.length > 0;

  if (room.visibility === "private" && !isMember) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const memberCount = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM room_members WHERE room_id = ${roomId}
  `;

  const members = await sql<{ userId: string; username: string; role: string }[]>`
    SELECT rm.user_id AS "userId", u.username, rm.role
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ${roomId}
  `;

  const summary: RoomSummary = {
    id: room.id,
    name: room.name,
    description: room.description,
    visibility: room.visibility,
    ownerId: room.owner_id,
    memberCount: memberCount[0]!.count,
    joinedAt: isMember ? membership[0]!.joined_at.toISOString() : undefined,
  };

  return Response.json({ room: summary, members });
}

export async function DELETE(
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
  const room = rooms[0];
  if (!room) return Response.json({ error: "not found" }, { status: 404 });

  const userId = session.user_id;
  const membership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (membership.length === 0 || membership[0]!.role !== "owner") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;

  let filePaths: string[] = [];

  await sql.begin(async (tx) => {
    const rows = await tx<{ storage_path: string }[]>`
      SELECT a.storage_path
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      WHERE m.room_id = ${roomId}
    `;
    filePaths = rows.map((r) => r.storage_path);

    await tx`
      DELETE FROM attachments
      WHERE message_id IN (SELECT id FROM messages WHERE room_id = ${roomId})
    `;
    await tx`DELETE FROM messages WHERE room_id = ${roomId}`;
    await tx`UPDATE rooms SET deleted_at = NOW() WHERE id = ${roomId}`;
  });

  for (const p of filePaths) {
    try {
      await unlink(path.join(FILES_ROOT, p));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[room-delete] failed to unlink', p, err);
      }
    }
  }

  broadcast(
    memberIds.map((m) => m.user_id),
    { type: "ROOM_DELETED", payload: { roomId }, timestamp: Date.now() },
  );

  return Response.json({ ok: true });
}

export async function PATCH(
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

  const userId = session.user_id;
  const membership = await sql<RoomMemberRow[]>`
    SELECT room_id, user_id, role, joined_at
    FROM room_members WHERE room_id = ${roomId} AND user_id = ${userId}
  `;
  if (membership.length === 0 || membership[0]!.role === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const updateSchema = z.object({
    name: z.string().min(3).max(48).regex(/^[a-zA-Z0-9_-]+$/, "invalid name").optional(),
    description: z.string().max(256).nullable().optional(),
    visibility: z.enum(["public", "private"]).optional(),
  });
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  }

  const { name, description, visibility } = parsed.data;

  const finalName = name ?? room.name;
  const finalDesc = description !== undefined ? description : room.description;
  const finalVis = visibility ?? room.visibility;

  await sql`
    UPDATE rooms
    SET name = ${finalName}, description = ${finalDesc}, visibility = ${finalVis}
    WHERE id = ${roomId} AND deleted_at IS NULL
  `;

  const memberIds = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_members WHERE room_id = ${roomId}
  `;

  broadcast(
    memberIds.map((m) => m.user_id),
    { type: "ROOM_UPDATED", payload: { roomId, name: finalName, description: finalDesc, visibility: finalVis }, timestamp: Date.now() },
  );

  return Response.json({ ok: true });
}
