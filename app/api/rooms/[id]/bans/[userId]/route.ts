import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { roomMemberPathSchema } from "@/lib/schemas";
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

  const callerRole = await getRoomRole(roomId, session.user_id);
  if (!callerRole || callerRole === "member") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const banRows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM room_bans
    WHERE room_id = ${roomId} AND user_id = ${targetUserId}
  `;
  if (banRows.length === 0) {
    return Response.json({ error: "not banned" }, { status: 404 });
  }

  await sql`
    DELETE FROM room_bans
    WHERE room_id = ${roomId} AND user_id = ${targetUserId}
  `;

  return new Response(null, { status: 204 });
}
