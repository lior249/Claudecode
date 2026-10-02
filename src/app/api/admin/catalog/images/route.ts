import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { ImageError, MAX_IMAGE_BYTES, storeCatalogImage } from "@/server/storage/images";
import { fileUrl } from "@/server/decisions/service";

// Envoi d'une image pour une fiche du catalogue (Admin uniquement).
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Introuvable." }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Image trop lourde : 10 Mo maximum." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Image vide." }, { status: 400 });
  try {
    const key = await storeCatalogImage(Readable.fromWeb(request.body as unknown as WebReadableStream));
    return Response.json({ key, url: fileUrl(key) });
  } catch (e) {
    if (e instanceof ImageError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[catalog-image]", e);
    return Response.json({ error: "Envoi impossible. Réessaie." }, { status: 500 });
  }
}
