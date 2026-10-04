import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/server/auth/session";
import { filePath } from "@/server/storage/storage";
import { getOnboardingVideo } from "@/server/onboarding/service";

// Vidéo d'accueil (membres connectés). Gère les requêtes partielles (Range) pour le lecteur vidéo.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  const video = user ? await getOnboardingVideo() : null;
  if (!video) return new Response("Introuvable", { status: 404 });
  const path = filePath(video.key);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
  const headers: Record<string, string> = { "Content-Type": video.mime, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
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
