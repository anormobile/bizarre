import sql from "@/lib/db";

export async function isAdmin(userId: string): Promise<boolean> {
  const rows = await sql<{ is_admin: boolean }[]>`
    SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1
  `;
  return rows[0]?.is_admin === true;
}
