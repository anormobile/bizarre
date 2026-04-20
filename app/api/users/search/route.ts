import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { userSearchQuerySchema } from "@/lib/schemas";
import type { SessionRow, UserSummary, FriendshipRow } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function GET(request: Request) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const parsed = userSearchQuerySchema.safeParse({ q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { q } = parsed.data;
  const me = session.user_id;
  const pattern = q + "%";

  const rows = await sql<{ id: string; username: string }[]>`
    SELECT id, username FROM users
    WHERE username ILIKE ${pattern}
      AND id != ${me}
      AND deleted_at IS NULL
    ORDER BY username ASC
    LIMIT 20
  `;

  if (rows.length === 0) {
    return Response.json({ users: [] });
  }

  const otherIds = rows.map((r) => r.id);
  const friendships = await sql<FriendshipRow[]>`
    SELECT user_a, user_b, status, requested_by, note, created_at
    FROM friendships
    WHERE (user_a = ${me} AND user_b = ANY(${otherIds}))
       OR (user_b = ${me} AND user_a = ANY(${otherIds}))
  `;

  const friendMap = new Map<string, FriendshipRow>();
  for (const f of friendships) {
    const other = f.user_a === me ? f.user_b : f.user_a;
    friendMap.set(other, f);
  }

  const users: UserSummary[] = rows.map((r) => {
    const f = friendMap.get(r.id);
    let friendship: UserSummary["friendship"] = "none";
    if (f) {
      if (f.status === "confirmed") {
        friendship = "confirmed";
      } else if (f.requested_by === me) {
        friendship = "pending_outgoing";
      } else {
        friendship = "pending_incoming";
      }
    }
    return { userId: r.id, username: r.username, friendship };
  });

  return Response.json({ users });
}
