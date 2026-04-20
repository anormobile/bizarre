import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import type { SessionRow, FriendView } from "@/lib/types";

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

  const rows = await sql<{ userId: string; username: string; since: Date; status: string | null }[]>`
    SELECT
      CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END AS "userId",
      u.username,
      f.created_at AS "since",
      COALESCE(up.status, 'offline') AS status
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END
    LEFT JOIN user_presence up ON up.user_id = CASE WHEN f.user_a = ${me} THEN f.user_b ELSE f.user_a END
    WHERE f.status = 'confirmed'
      AND (f.user_a = ${me} OR f.user_b = ${me})
    ORDER BY u.username ASC
  `;

  const friends: FriendView[] = rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    since: r.since.toISOString(),
    status: (r.status as FriendView["status"]) ?? "offline",
  }));

  return Response.json({ friends });
}
