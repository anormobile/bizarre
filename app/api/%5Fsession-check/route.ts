import { type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { sessionCheckModeSchema } from "@/lib/schemas";
import {
  generateSessionId,
  signSessionId,
  setSessionCookie,
  readSessionId,
  hashSessionId,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  if (env.NODE_ENV === "production" && !env.ENABLE_DEV_ROUTES) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  const parsed = sessionCheckModeSchema.safeParse(modeParam);

  if (!parsed.success) {
    return Response.json(
      { error: "mode must be one of: set, read, tamper" },
      { status: 400 },
    );
  }

  const mode = parsed.data;

  if (mode === "set") {
    const sessionId = generateSessionId();
    const tokenHash = hashSessionId(sessionId);
    await setSessionCookie(sessionId);
    return Response.json({
      ok: true,
      token_hash: tokenHash,
    });
  }

  if (mode === "read") {
    const sessionId = await readSessionId();
    if (!sessionId) {
      return Response.json({ ok: false, reason: "no valid session cookie" });
    }
    return Response.json({
      ok: true,
      token_hash: hashSessionId(sessionId),
    });
  }

  // mode === "tamper"
  const sessionId = await readSessionId();

  if (!sessionId) {
    const fakeId = generateSessionId();
    const tampered = signSessionId(fakeId).slice(0, -4) + "dead";
    return Response.json({
      ok: true,
      tampered_cookie: tampered,
      note: "no cookie was set; generated a tampered value for inspection",
    });
  }

  const original = signSessionId(sessionId);
  const tampered = original.slice(0, -4) + "dead";
  return Response.json({
    ok: true,
    original_valid: true,
    tampered_cookie: tampered,
    note: "tampered value will fail verification on next read",
  });
}
