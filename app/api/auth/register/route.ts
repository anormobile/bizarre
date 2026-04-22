import sql from "@/lib/db";
import { registerInputSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { createSession, signSessionId, getSessionCookieConfig } from "@/lib/session";
import type { UserRow, PublicUser } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }

  const { email, username, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  let user: UserRow;
  try {
    const rows = await sql<UserRow[]>`
      INSERT INTO users (email, username, password_hash)
      VALUES (${email}, ${username}, ${passwordHash})
      RETURNING id, email, username, password_hash, created_at, deleted_at
    `;
    user = rows[0]!;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      const detail =
        "detail" in err ? String((err as { detail: string }).detail) : "";
      if (detail.includes("email")) {
        return Response.json({ error: "email already in use" }, { status: 409 });
      }
      if (detail.includes("username")) {
        return Response.json(
          { error: "username already in use" },
          { status: 409 },
        );
      }
      return Response.json(
        { error: "email or username already in use" },
        { status: 409 },
      );
    }
    throw err;
  }

  const sessionId = await createSession(user.id, request.headers);
  const cookieConfig = getSessionCookieConfig();

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    username: user.username,
  };
  return Response.json({
    ok: true,
    user: publicUser,
    sessionCookie: {
      name: cookieConfig.name,
      value: signSessionId(sessionId),
      maxAge: cookieConfig.maxAge,
    },
  }, { status: 201 });
}
