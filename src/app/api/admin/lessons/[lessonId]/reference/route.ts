import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getCurrentUser } from "@/server/auth/session";
import { isSameOrigin } from "@/server/http/origin";
import { prisma } from "@/server/db";
import { MAX_FILE_BYTES, parsePracticeConfig } from "@/server/practice/config";
import { PracticeError, registerReferenceUpload } from "@/server/practice/service";
import type { Prisma } from "@/generated/prisma/client";

// Envoi du fichier de référence d'un exercice (Admin uniquement).
export async function POST(request: Request, ctx: RouteContext<"/api/admin/lessons/[lessonId]/reference">) {
  if (!isSameOrigin(request)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return Response.json({ error: "Introuvable." }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) {
    return Response.json({ error: "Fichier trop lourd : 200 Mo maximum." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "Fichier vide." }, { status: 400 });

  const { lessonId } = await ctx.params;
  let name = "reference";
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") ?? "reference");
  } catch {}

  try {
    const asset = await registerReferenceUpload({
      adminId: user.id,
      lessonId,
      originalName: name,
      body: Readable.fromWeb(request.body as unknown as WebReadableStream),
    });
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const config = { ...parsePracticeConfig(lesson.config), referenceAssetId: asset.id };
    await prisma.lesson.update({ where: { id: lessonId }, data: { config: config as unknown as Prisma.InputJsonValue } });
    await prisma.auditLog.create({ data: { actorUserId: user.id, action: "PRACTICE_REFERENCE_UPLOADED", entityType: "lesson", entityId: lessonId, metadata: { assetId: asset.id } } });
    return Response.json({ asset });
  } catch (e) {
    if (e instanceof PracticeError) return Response.json({ error: e.message }, { status: 400 });
    console.error("[reference-upload]", e);
    return Response.json({ error: "Impossible d'envoyer le fichier pour le moment. Réessaie." }, { status: 500 });
  }
}
