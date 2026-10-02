import { prisma } from "@/server/db";

// Surveillance : le site répond et la base de données est joignable.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
