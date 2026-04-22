import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import type { SessionRow } from "@/lib/types";

export default async function AdminXmppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession(async (tokenHash) => {
    const rows = await sql<SessionRow[]>`
      SELECT id, user_id, token_hash, browser, os, ip, created_at, last_seen_at
      FROM sessions WHERE token_hash = ${tokenHash}
    `;
    return rows[0];
  });

  if (!session) {
    redirect("/login");
  }

  const admin = await isAdmin(session.user_id);
  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-500">403 — Admin access only</p>
      </div>
    );
  }

  return <>{children}</>;
}
