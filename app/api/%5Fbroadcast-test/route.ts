import { env } from "@/lib/env";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { broadcastTestInputSchema } from "@/lib/schemas";
import { broadcast } from "@/lib/websocket";
import type { SessionRow, BroadcastTestMessage } from "@/lib/types";

export async function POST(request: Request) {
  if (!env.ENABLE_DEV_ROUTES) {
    return new Response(null, { status: 404 });
  }

  const session = await getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions
      WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });

  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const parsed = broadcastTestInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const msg: BroadcastTestMessage = {
    type: "BROADCAST_TEST",
    payload: { text: parsed.data.text },
    timestamp: Date.now(),
  };

  const delivered = broadcast([session.user_id], msg);

  return Response.json({ ok: true, delivered });
}
