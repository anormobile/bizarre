import * as fs from "node:fs/promises";
import sql from "@/lib/db";
import { getSession, clearSessionCookie } from "@/lib/session";
import { deleteAccountSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/password";
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

export async function DELETE(request: Request) {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const { password } = parsed.data;
  const userId = session.user_id;

  const userRows = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${userId} AND deleted_at IS NULL
  `;
  if (userRows.length === 0) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  const valid = await verifyPassword(password, userRows[0]!.password_hash);
  if (!valid) {
    return Response.json({ error: "invalid password" }, { status: 401 });
  }

  let storagePaths: string[] = [];

  await sql.begin(async (tx) => {
    const attachmentRows = await tx<{ storage_path: string }[]>`
      SELECT a.storage_path
      FROM attachments a
      JOIN messages m ON m.id = a.message_id
      JOIN rooms r ON r.id = m.room_id
      WHERE r.owner_id = ${userId} AND r.deleted_at IS NULL
    `;
    storagePaths = attachmentRows.map((r) => r.storage_path);

    await tx`
      UPDATE rooms SET deleted_at = NOW()
      WHERE owner_id = ${userId} AND deleted_at IS NULL
    `;

    await tx`
      DELETE FROM messages WHERE dm_id IN (
        SELECT id FROM dms WHERE user_a = ${userId} OR user_b = ${userId}
      )
    `;
    await tx`DELETE FROM dms WHERE user_a = ${userId} OR user_b = ${userId}`;

    await tx`DELETE FROM room_members WHERE user_id = ${userId}`;

    await tx`DELETE FROM friendships WHERE user_a = ${userId} OR user_b = ${userId}`;
    await tx`DELETE FROM user_bans WHERE blocker_id = ${userId} OR blocked_id = ${userId}`;
    await tx`DELETE FROM room_invitations WHERE invited_user = ${userId} OR invited_by = ${userId}`;
    await tx`DELETE FROM user_presence WHERE user_id = ${userId}`;
    await tx`DELETE FROM sessions WHERE user_id = ${userId}`;

    await tx`
      UPDATE users
      SET deleted_at = NOW(),
          email = ${'deleted-' + userId + '@deleted.local'},
          username = ${'deleted-' + userId.slice(0, 8)}
      WHERE id = ${userId}
    `;
  });

  for (const p of storagePaths) {
    try {
      await fs.unlink(p);
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[delete-account] failed to remove file", p, err);
      }
    }
  }

  await clearSessionCookie();

  return Response.json({ ok: true });
}
