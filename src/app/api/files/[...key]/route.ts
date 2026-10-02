import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/server/auth/session";
import { filePath, readStream } from "@/server/storage/storage";
import { MIME_BY_EXT } from "@/server/storage/images";

// Images du catalogue, réservées aux personnes connectées. Les fichiers des élèves ne passent jamais par ici.
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  if (!(await getCurrentUser())) return new Response("Introuvable", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const match = key.match(/^catalog\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
  if (!match) return new Response("Introuvable", { status: 404 });
  try {
    const info = await stat(filePath(key));
    return new Response(Readable.toWeb(readStream(key)) as ReadableStream, {
      headers: {
        "Content-Type": MIME_BY_EXT[match[1]],
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
