import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/server/auth/session";
import { filePath, readStream } from "@/server/storage/storage";
import { AVATAR_KEY, MIME_BY_EXT, USER_IMAGE_KEY } from "@/server/storage/images";
import { canSeeUpload } from "@/server/coaching/access";
import { isPublicResultImage } from "@/server/results/service";

// Images : catalogue, photos de profil et captures de résultats du mois validées (toute personne connectée) et images privées des tickets / preuves (élève, son coach, admins).
// Les vidéos et audios des élèves ne passent jamais par ici.
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Introuvable", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const catalog = key.match(/^catalog\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
  const upload = key.match(USER_IMAGE_KEY);
  const match = catalog ?? key.match(AVATAR_KEY) ?? upload;
  if (!match) return new Response("Introuvable", { status: 404 });
  if (upload && !(await canSeeUpload(user, upload[1])) && !(await isPublicResultImage(key))) return new Response("Introuvable", { status: 404 });
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
