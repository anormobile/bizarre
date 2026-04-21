import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { userIdParamSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, FriendshipRow } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const paramParsed = userIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const me = session.user_id;
  const other = paramParsed.data.id;

  const [userA, userB] = [me, other].sort() as [string, string];

  const rows = await sql<FriendshipRow[]>`
    SELECT user_a, user_b, status, requested_by, note, created_at
    FROM friendships
    WHERE user_a = ${userA} AND user_b = ${userB}
  `;

  const row = rows[0];
  if (!row || row.status !== "pending") {
    return Response.json({ error: "request not found" }, { status: 404 });
  }

  const requester = row.requested_by;

  await sql`
    DELETE FROM friendships
    WHERE user_a = ${userA} AND user_b = ${userB}
  `;

  if (requester !== me) {
    broadcast([requester], {
      type: "FRIEND_REQUEST_DECLINED",
      payload: { userId: me },
      timestamp: Date.now(),
    });
  }

  return Response.json({ ok: true }, { status: 200 });
}
