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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const invitationId = Number(id);
  if (!Number.isFinite(invitationId)) return Response.json({ error: "not found" }, { status: 404 });

  const result = await sql`
    UPDATE room_invitations SET status = 'declined'
    WHERE id = ${invitationId} AND invited_user = ${session.user_id} AND status = 'pending'
  `;

  if (result.count === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
