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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  const target = await sql<{ id: string; user_id: string }[]>`
    SELECT id, user_id FROM sessions WHERE id = ${id}
  `;

  if (target.length === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (target[0]!.user_id !== session.user_id) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await sql`DELETE FROM sessions WHERE id = ${id}`;

  return Response.json({ ok: true });
}
