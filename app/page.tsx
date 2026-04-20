import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";
import { WsStatus } from "@/components/WsStatus";
import { Shell } from "@/components/Shell";
import type { SessionRow, RoomSummary } from "@/lib/types";

export default async function Home() {
  const session = await getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions
      WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });

  if (!session) redirect("/login");

  const users = await sql<{ id: string; username: string }[]>`
    SELECT id, username FROM users WHERE id = ${session.user_id}
  `;
  const user = users[0];
  if (!user) redirect("/login");

  const mine = await sql<RoomSummary[]>`
    SELECT
      r.id,
      r.name,
      r.description,
      r.visibility,
      r.owner_id AS "ownerId",
      (SELECT COUNT(*)::int FROM room_members WHERE room_id = r.id) AS "memberCount",
      rm.joined_at AS "joinedAt"
    FROM rooms r
    JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ${session.user_id}
    WHERE r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">@{user.username}</span>
          <WsStatus />
        </div>
        <LogoutButton />
      </header>
      <Shell initialMine={mine} currentUserId={session.user_id} currentUsername={user.username} />
    </div>
  );
}
