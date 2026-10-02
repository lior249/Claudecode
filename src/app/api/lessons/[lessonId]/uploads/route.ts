import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { MAX_FILE_BYTES } from "@/server/practice/config";
import { PracticeError, registerUpload } from "@/server/practice/service";

// Envoi d'un fichier d'exercice (flux brut, enregistré sur le disque au fil de l'eau).
export async function POST(request: Request, ctx: RouteContext<"/api/lessons/[lessonId]/uploads">) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Reconnecte-toi." }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES) return Response.json({ error: "Fichier trop lourd : 200 Mo maximum." }, { status: 413 });
  if (!request.body) return Response.json({ error: "Fichier vide." }, { status: 400 });

  const { lessonId } = await ctx.params;
  let name = "fichier";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "fichier");
  } catch {}

  try {
    const asset = await registerUpload({
      userId: user.id,
      lessonId,
      originalName: name,
      body: Readable.fromWeb(request.body as unknown as WebReadableStream),
    });
    return Response.json({ asset });
  } catch (e) {
    if (e instanceof PracticeError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[upload]", e);
    return Response.json({ error: "Impossible d'envoyer ton fichier pour le moment. Réessaie." }, { status: 500 });
  }
}
