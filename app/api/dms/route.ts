import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import type { SessionRow, MessageView, DmThreadView } from "@/lib/types";

async function authenticate(): Promise<SessionRow | null> {
  return getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });
}

export async function GET() {
  const session = await authenticate();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const me = session.user_id;

  const rows = await sql<{
    dm_id: number;
    other_id: string;
    other_username: string;
    last_activity: Date;
    last_msg_id: number | null;
    last_msg_user_id: string | null;
    last_msg_username: string | null;
    last_msg_content: string | null;
    last_msg_created_at: Date | null;
    last_msg_edited_at: Date | null;
    last_msg_deleted_at: Date | null;
    last_msg_dm_id: number | null;
  }[]>`
    SELECT
      d.id AS dm_id,
      CASE WHEN d.user_a = ${me} THEN d.user_b ELSE d.user_a END AS other_id,
      u.username AS other_username,
      COALESCE(
        (SELECT MAX(m.created_at) FROM messages m WHERE m.dm_id = d.id AND m.deleted_at IS NULL),
        d.created_at
      ) AS last_activity,
      lm.id AS last_msg_id,
      lm.user_id AS last_msg_user_id,
      lmu.username AS last_msg_username,
      lm.content AS last_msg_content,
      lm.created_at AS last_msg_created_at,
      lm.edited_at AS last_msg_edited_at,
      lm.deleted_at AS last_msg_deleted_at,
      lm.dm_id AS last_msg_dm_id
    FROM dms d
    JOIN users u ON u.id = CASE WHEN d.user_a = ${me} THEN d.user_b ELSE d.user_a END
    LEFT JOIN LATERAL (
      SELECT m.* FROM messages m
      WHERE m.dm_id = d.id AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC LIMIT 1
    ) lm ON TRUE
    LEFT JOIN users lmu ON lmu.id = lm.user_id
    WHERE (d.user_a = ${me} OR d.user_b = ${me})
      AND u.deleted_at IS NULL
    ORDER BY last_activity DESC
  `;

  const threads: DmThreadView[] = rows.map((r) => {
    let lastMessage: MessageView | null = null;
    if (r.last_msg_id !== null) {
      lastMessage = {
        id: r.last_msg_id,
        roomId: null,
        dmId: r.last_msg_dm_id,
        userId: r.last_msg_user_id!,
        username: r.last_msg_username!,
        content: r.last_msg_content!,
        createdAt: r.last_msg_created_at!.toISOString(),
        editedAt: r.last_msg_edited_at ? r.last_msg_edited_at.toISOString() : null,
        deletedAt: r.last_msg_deleted_at ? r.last_msg_deleted_at.toISOString() : null,
        attachments: [],
        replyToId: null,
        replyTo: null,
      };
    }
    return {
      dmId: r.dm_id,
      userId: r.other_id,
      username: r.other_username,
      lastMessage,
      lastActivityAt: r.last_activity.toISOString(),
    };
  });

  return Response.json({ threads });
}
