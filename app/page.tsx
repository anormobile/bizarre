import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";
import { WsStatus } from "@/components/WsStatus";
import type { SessionRow } from "@/lib/types";

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

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4">
      <p className="text-lg">
        Signed in as <span className="font-semibold">@{user.username}</span>
      </p>
      <LogoutButton />
      <WsStatus />
    </div>
  );
}
