import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcast } from "@/lib/websocket";
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: blockedId } = await params;
  const blockerId = session.user_id;

  if (blockerId === blockedId) {
    return Response.json({ error: "cannot ban self" }, { status: 400 });
  }

  const targetRows = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${blockedId} AND deleted_at IS NULL
  `;
  if (targetRows.length === 0) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO user_bans (blocker_id, blocked_id)
      VALUES (${blockerId}, ${blockedId})
      ON CONFLICT DO NOTHING
    `;
    const [a, b] = [blockerId, blockedId].sort();
    await tx`
      DELETE FROM friendships
      WHERE user_a = ${a} AND user_b = ${b}
    `;
  });

  broadcast(
    [blockedId],
    { type: "USER_BAN_NOTIFY", payload: { fromUserId: blockerId }, timestamp: Date.now() },
  );

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id: blockedId } = await params;
  const blockerId = session.user_id;

  await sql`
    DELETE FROM user_bans
    WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
  `;

  return Response.json({ ok: true });
}
