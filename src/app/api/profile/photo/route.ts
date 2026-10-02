import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { ImageError, MAX_IMAGE_BYTES } from "@/server/storage/images";
import { setProfilePhoto } from "@/server/profile/service";

// Nouvelle photo de profil (remplace la photo Discord). Toute personne connectée.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Reconnecte-toi." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image trop lourde : 10 Mo maximum." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Image vide." }, { status: 400 });
  try {
    const url = await setProfilePhoto(user.id, Readable.fromWeb(request.body as unknown as WebReadableStream));
    return Response.json({ url });
  } catch (e) {
    if (e instanceof ImageError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[profile-photo]", e);
    return Response.json({ error: "Envoi impossible. Réessaie." }, { status: 500 });
  }
}
