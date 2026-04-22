import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { createRoomInputSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, RoomRow, RoomSummary } from "@/lib/types";

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

  const parsed = createRoomInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { name, description, visibility } = parsed.data;
  const userId = session.user_id;

  let room: RoomRow;
  try {
    const result = await sql.begin(async (tx) => {
      const rooms = await tx<RoomRow[]>`
        INSERT INTO rooms (name, description, visibility, owner_id)
        VALUES (${name}, ${description ?? null}, ${visibility}, ${userId})
        RETURNING id, name, description, visibility, owner_id, created_at, deleted_at
      `;
      const r = rooms[0]!;
      await tx`
        INSERT INTO room_members (room_id, user_id, role)
        VALUES (${r.id}, ${userId}, 'owner')
      `;
      return r;
    });
    room = result;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return Response.json({ error: "name taken" }, { status: 409 });
    }
    throw err;
  }

  const summary: RoomSummary = {
    id: room.id,
    name: room.name,
    description: room.description,
    visibility: room.visibility,
    ownerId: room.owner_id,
    memberCount: 1,
    joinedAt: new Date().toISOString(),
  };

  broadcast([userId], {
    type: "ROOM_UPDATED",
    payload: {
      roomId: room.id,
      name: room.name,
      description: room.description,
      visibility: room.visibility,
    },
    timestamp: Date.now(),
  });

  return Response.json({ room: summary }, { status: 201 });
}

export async function GET() {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const userId = session.user_id;

  const mine = await sql<(RoomSummary & { joinedAt: string })[]>`
    SELECT
      r.id,
      r.name,
      r.description,
      r.visibility,
      r.owner_id AS "ownerId",
      (SELECT COUNT(*)::int FROM room_members WHERE room_id = r.id) AS "memberCount",
      rm.joined_at AS "joinedAt"
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ${userId}
    WHERE r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `;

  const publicCatalog = await sql<RoomSummary[]>`
    SELECT
      r.id,
      r.name,
      r.description,
      r.visibility,
      r.owner_id AS "ownerId",
      (SELECT COUNT(*)::int FROM room_members WHERE room_id = r.id) AS "memberCount",
      EXISTS (SELECT 1 FROM room_members WHERE room_id = r.id AND user_id = ${userId}) AS "joined"
    FROM rooms r
    WHERE r.visibility = 'public'
      AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `;

  return Response.json({ mine, publicCatalog });
}
