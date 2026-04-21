import sql from "@/lib/db";
import { loginInputSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import type { UserRow, PublicUser } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid input";
    return Response.json({ error: msg }, { status: 400 });
  }

  const { emailOrUsername, password } = parsed.data;

  const rows = await sql<UserRow[]>`
    SELECT id, email, username, password_hash, created_at, deleted_at
    FROM users
    WHERE (email = ${emailOrUsername} OR username = ${emailOrUsername})
      AND deleted_at IS NULL
  `;

  if (rows.length === 0) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }

  const user = rows[0]!;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }

  await createSession(user.id, request.headers);

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    username: user.username,
  };
  return Response.json({ ok: true, user: publicUser });
}
