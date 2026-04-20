import {
  readSessionId,
  hashSessionId,
  deleteSessionByHash,
  clearSessionCookie,
} from "@/lib/session";

export async function POST() {
  const sessionId = await readSessionId();
  if (sessionId) {
    await deleteSessionByHash(hashSessionId(sessionId));
  } else {
    await clearSessionCookie();
  }
  return Response.json({ ok: true });
}
