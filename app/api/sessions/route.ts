import sql from "@/lib/db";
import { getSession } from "@/lib/session";
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

export async function GET() {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await sql<
    { id: string; browser: string | null; os: string | null; ip: string | null; created_at: Date; last_seen_at: Date }[]
  >`
    SELECT id, browser, os, ip, created_at, last_seen_at
    FROM sessions
    WHERE user_id = ${session.user_id}
    ORDER BY last_seen_at DESC
  `;

  const currentSessionId = session.id;
  const sessions = rows.map((r) => ({
    id: r.id,
    browser: r.browser,
    os: r.os,
    ip: r.ip,
    createdAt: r.created_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
    current: r.id === currentSessionId,
  }));

  return Response.json({ sessions });
}
