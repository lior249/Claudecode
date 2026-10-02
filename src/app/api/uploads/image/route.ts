import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { ImageError, MAX_IMAGE_BYTES, storeUserImage } from "@/server/storage/images";
import { fileUrl } from "@/server/decisions/service";

// Envoi d'une image privée (ticket, preuve de résultats). Réservé aux élèves en coaching, coachs et admins.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Reconnecte-toi." }, { status: 401 });
  if (user.role === "LEARNER" && user.coachingStatus === "NONE") return Response.json({ error: "Réservé au coaching." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image trop lourde : 10 Mo maximum." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Image vide." }, { status: 400 });
  try {
    const key = await storeUserImage(user.id, Readable.fromWeb(request.body as unknown as WebReadableStream));
    return Response.json({ key, url: fileUrl(key) });
  } catch (e) {
    if (e instanceof ImageError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[image-upload]", e);
    return Response.json({ error: "Envoi impossible. Réessaie." }, { status: 500 });
  }
}
