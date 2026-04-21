import { randomBytes, createHash } from "node:crypto";
import sql from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/schemas";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { email } = parsed.data;
  const ok200 = () => Response.json({ ok: true });

  const users = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email} AND deleted_at IS NULL
  `;
  if (users.length === 0) return ok200();

  const userId = users[0]!.id;

  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM password_reset_tokens
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '15 minutes'
  `;
  if (count >= 5) return ok200();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await sql`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, NOW() + INTERVAL '30 minutes')
  `;

  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token=${token}`;

  console.info("[forgot-password]", resetUrl);

  if (env.NODE_ENV !== "production") {
    return Response.json({ ok: true, resetUrl });
  }

  return ok200();
}
