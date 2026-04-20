import sql from "@/lib/db";

export async function GET() {
  try {
    await sql`SELECT 1`;
    return Response.json({ status: "ok", db: "connected" });
  } catch {
    return Response.json(
      { status: "error", db: "disconnected" },
      { status: 503 },
    );
  }
}
