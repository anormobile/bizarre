import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import type { SessionRow, JabberConnection } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

interface ProsodySession {
  jid: string;
  domain: string;
  remoteIp: string;
  since: string;
}

const PROSODY_BASES = ["http://xmpp-a:5280", "http://xmpp-b:5280"];

async function fetchProsodySessions(base: string): Promise<JabberConnection[]> {
  const res = await fetch(`${base}/admin_api/sessions`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Prosody ${base} returned ${res.status}`);
  const data = await res.json();
  const raw: ProsodySession[] = Array.isArray(data.sessions) ? data.sessions : [];
  return raw.map((s) => ({
    jid: s.jid,
    domain: s.domain,
    remoteIp: s.remoteIp,
    since: s.since,
  }));
}

export async function GET() {
  const session = await authenticate();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(session.user_id);
  if (!admin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const results = await Promise.allSettled(
    PROSODY_BASES.map((base) => fetchProsodySessions(base)),
  );

  const connections: JabberConnection[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      connections.push(...result.value);
    } else {
      console.error("Prosody fetch error:", result.reason);
    }
  }

  connections.sort((a, b) => b.since.localeCompare(a.since));

  return Response.json({ connections });
}
