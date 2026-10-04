import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { deleteFile, filePath, FileTooLargeError, writeStream } from "@/server/storage/storage";
import { MediaError, probe } from "@/server/media/ffmpeg";

// Accueil en 4 étapes à la première connexion ; la vidéo de l'étape 1 est envoyée par l'admin.

export class OnboardingError extends Error {}

const VIDEO_KEY = "onboardingVideo";
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const EXT_MIME: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };

interface StoredVideo {
  key: string;
  name: string;
  mime: string;
}

export async function getOnboardingVideo(): Promise<StoredVideo | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: VIDEO_KEY } });
  return (row?.value as unknown as StoredVideo | null) ?? null;
}

/** Remplace la vidéo d'accueil (MP4, MOV ou WebM, 500 Mo maximum). */
export async function setOnboardingVideo(adminId: string, originalName: string, body: Readable) {
  const ext = path.extname(originalName).toLowerCase();
  if (!EXT_MIME[ext]) throw new OnboardingError("Formats acceptés : MP4, MOV ou WebM.");
  const key = `onboarding/${randomUUID()}${ext}`;
  try {
    await writeStream(key, body, MAX_VIDEO_BYTES);
  } catch (e) {
    if (e instanceof FileTooLargeError) throw new OnboardingError("Vidéo trop lourde : 500 Mo maximum.");
    throw e;
  }
  try {
    const info = await probe(filePath(key));
    if (!info.hasVideo) throw new OnboardingError("Ce fichier ne contient pas de vidéo.");
  } catch (e) {
    await deleteFile(key);
    if (e instanceof MediaError) throw new OnboardingError("Vidéo illisible. Exporte-la à nouveau puis réessaie.");
    throw e;
  }
  const before = await getOnboardingVideo();
  const value: StoredVideo = { key, name: originalName.slice(0, 200), mime: EXT_MIME[ext] };
  await prisma.appSetting.upsert({ where: { key: VIDEO_KEY }, create: { key: VIDEO_KEY, value: { ...value } }, update: { value: { ...value } } });
  if (before) await deleteFile(before.key);
  await prisma.auditLog.create({ data: { actorUserId: adminId, action: "ONBOARDING_VIDEO_SET", entityType: "setting", entityId: VIDEO_KEY, metadata: { name: value.name } } });
  return value;
}

export async function removeOnboardingVideo(adminId: string) {
  const before = await getOnboardingVideo();
  if (!before) return;
  await prisma.appSetting.delete({ where: { key: VIDEO_KEY } });
  await deleteFile(before.key);
  await prisma.auditLog.create({ data: { actorUserId: adminId, action: "ONBOARDING_VIDEO_REMOVED", entityType: "setting", entityId: VIDEO_KEY } });
}

export const needsOnboarding = (u: { onboardedAt: Date | null }) => !u.onboardedAt;

export async function completeOnboarding(userId: string, now = new Date()) {
  await prisma.user.updateMany({ where: { id: userId, onboardedAt: null }, data: { onboardedAt: now } });
}
