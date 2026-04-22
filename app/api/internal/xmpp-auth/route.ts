import { z } from "zod";
import sql from "@/lib/db";
import { env } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

const bodySchema = z.object({
  user: z.string(),
  pass: z.string(),
  host: z.string().optional(),
});

const FALSE_RESULT = Response.json({ result: false });

export async function POST(request: Request) {
  const secret = request.headers.get("x-xmpp-auth-secret");
  if (!secret || secret !== env.XMPP_AUTH_SECRET) {
    return Response.json({ result: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ result: false }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ result: false }, { status: 400 });
  }

  const { user, pass } = parsed.data;

  const rows = await sql`
    SELECT password_hash FROM users
    WHERE email = ${user} OR username = ${user}
    LIMIT 1
  `;

  if (rows.length === 0) return FALSE_RESULT;

  const ok = await verifyPassword(pass, rows[0].password_hash);
  return Response.json({ result: ok });
}

export function GET() {
  return new Response(null, { status: 405 });
}
export function PUT() {
  return new Response(null, { status: 405 });
}
export function DELETE() {
  return new Response(null, { status: 405 });
}
export function PATCH() {
  return new Response(null, { status: 405 });
}
