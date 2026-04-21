import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { changePasswordInputSchema } from "@/lib/schemas";
import { verifyPassword, hashPassword } from "@/lib/password";
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

export async function POST(request: Request) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = changePasswordInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { oldPassword, newPassword } = parsed.data;
  const userId = session.user_id;

  const rows = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${userId} AND deleted_at IS NULL
  `;
  if (rows.length === 0) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  const valid = await verifyPassword(oldPassword, rows[0]!.password_hash);
  if (!valid) {
    return Response.json({ error: "wrong password" }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;

  return Response.json({ ok: true });
}
