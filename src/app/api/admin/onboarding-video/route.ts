import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { OnboardingError, setOnboardingVideo } from "@/server/onboarding/service";

// Envoi de la vidéo d'accueil (Admin uniquement). Le nom du fichier arrive dans l'en-tête x-file-name.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Introuvable." }, { status: 404 });
  if (!request.body) return Response.json({ error: "Vidéo vide." }, { status: 400 });
  const name = decodeURIComponent(request.headers.get("x-file-name") ?? "video.mp4");
  try {
    const video = await setOnboardingVideo(user.id, name, Readable.fromWeb(request.body as unknown as WebReadableStream));
    return Response.json({ name: video.name });
  } catch (e) {
    if (e instanceof OnboardingError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[onboarding-video]", e);
    return Response.json({ error: "Envoi impossible. Réessaie." }, { status: 500 });
  }
}
