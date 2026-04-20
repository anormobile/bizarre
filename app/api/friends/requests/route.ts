import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendFriendRequestInputSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, FriendshipRow, FriendRequestView, FriendView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function GET() {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const me = session.user_id;

  const incomingRows = await sql<{ userId: string; username: string; note: string | null; createdAt: Date }[]>`
    SELECT
      CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END AS "userId",
      u.username,
      f.note,
      f.created_at AS "createdAt"
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END
    WHERE f.status = 'pending'
      AND (f.user_a = ${me} OR f.user_b = ${me})
      AND f.requested_by != ${me}
    ORDER BY f.created_at DESC
  `;

  const outgoingRows = await sql<{ userId: string; username: string; note: string | null; createdAt: Date }[]>`
    SELECT
      CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END AS "userId",
      u.username,
      f.note,
      f.created_at AS "createdAt"
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END
    WHERE f.status = 'pending'
      AND (f.user_a = ${me} OR f.user_b = ${me})
      AND f.requested_by = ${me}
    ORDER BY f.created_at DESC
  `;

  const incoming: FriendRequestView[] = incomingRows.map((r) => ({
    userId: r.userId,
    username: r.username,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));

  const outgoing: FriendRequestView[] = outgoingRows.map((r) => ({
    userId: r.userId,
    username: r.username,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));

  return Response.json({ incoming, outgoing });
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

  const parsed = sendFriendRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { username, note: rawNote } = parsed.data;
  const note = rawNote?.trim() || null;
  const me = session.user_id;

  const targetRows = await sql<{ id: string; username: string }[]>`
    SELECT id, username FROM users
    WHERE username = ${username} AND deleted_at IS NULL
  `;
  const target = targetRows[0];
  if (!target) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  if (target.id === me) {
    return Response.json({ error: "self request" }, { status: 400 });
  }

  const [userA, userB] = [me, target.id].sort() as [string, string];
  const requesterIsA = me === userA;

  const existing = await sql<FriendshipRow[]>`
    SELECT user_a, user_b, status, requested_by, note, created_at
    FROM friendships
    WHERE user_a = ${userA} AND user_b = ${userB}
  `;

  if (existing.length > 0) {
    const row = existing[0]!;
    if (row.status === "confirmed") {
      return Response.json({ error: "already friends" }, { status: 409 });
    }
    if (row.requested_by === me) {
      return Response.json({ error: "already requested" }, { status: 409 });
    }

    await sql`
      UPDATE friendships
      SET status = 'confirmed'
      WHERE user_a = ${userA} AND user_b = ${userB}
    `;

    const callerRows = await sql<{ username: string }[]>`
      SELECT username FROM users WHERE id = ${me}
    `;
    const callerUsername = callerRows[0]!.username;

    broadcast([target.id], {
      type: "FRIEND_REQUEST_ACCEPTED",
      payload: { userId: me, username: callerUsername },
      timestamp: Date.now(),
    });

    const friend: FriendView = {
      userId: target.id,
      username: target.username,
      since: row.created_at.toISOString(),
    };

    return Response.json({ friend }, { status: 200 });
  }

  const inserted = await sql<FriendshipRow[]>`
    INSERT INTO friendships (user_a, user_b, status, requested_by, note)
    VALUES (${userA}, ${userB}, 'pending', ${me}, ${note})
    RETURNING user_a, user_b, status, requested_by, note, created_at
  `;
  const row = inserted[0]!;

  const callerRows = await sql<{ username: string }[]>`
    SELECT username FROM users WHERE id = ${me}
  `;
  const callerUsername = callerRows[0]!.username;

  broadcast([target.id], {
    type: "FRIEND_REQUEST_RECEIVED",
    payload: { fromUserId: me, fromUsername: callerUsername, note },
    timestamp: Date.now(),
  });

  const view: FriendRequestView = {
    userId: target.id,
    username: target.username,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };

  return Response.json({ request: view }, { status: 201 });
}
