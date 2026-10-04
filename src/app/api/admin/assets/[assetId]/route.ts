import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { filePath } from "@/server/storage/storage";

// Lecture d'un fichier d'élève (vidéo, audio) par un admin ou un coach (correction des exercices). Gère les requêtes partielles (Range) pour le lecteur vidéo.
export async function GET(request: Request, ctx: RouteContext<"/api/admin/assets/[assetId]">) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "COACH")) return new Response("Introuvable", { status: 404 });
  const { assetId } = await ctx.params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.deletedAt) return new Response("Introuvable", { status: 404 });

  const path = filePath(asset.storageKey);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
  };
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { headers: { ...headers, "Content-Length": String(size) } });
}
