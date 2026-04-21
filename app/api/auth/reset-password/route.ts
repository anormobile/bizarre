import { createHash } from "node:crypto";
import sql from "@/lib/db";
import { resetPasswordSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const rows = await sql<{ id: number; user_id: string }[]>`
    SELECT prt.id, prt.user_id
    FROM password_reset_tokens prt
    WHERE prt.token_hash = ${tokenHash}
      AND prt.used_at IS NULL
      AND prt.expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) {
    return Response.json({ error: "invalid or expired token" }, { status: 400 });
  }

  const { id: resetId, user_id: userId } = rows[0]!;
  const newHash = await hashPassword(newPassword);

  await sql.begin(async (tx) => {
    await tx`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;
    await tx`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${resetId}`;
    await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
  });

  return Response.json({ ok: true });
}
