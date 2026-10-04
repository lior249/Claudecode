import "server-only";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { assertCanStartLesson, LessonLockedError } from "@/server/learn/service";
import { deleteFile, filePath, FileTooLargeError, writeStream } from "@/server/storage/storage";
import { MediaError, probe } from "@/server/media/ffmpeg";
import { pruneOldSubmissionFiles } from "@/server/retention/service";
import { notify } from "@/server/notifications/service";
import type { Prisma } from "@/generated/prisma/client";
import {
  ACCEPTED_EXTENSIONS,
  isPracticeReady,
  MAX_FILE_BYTES,
  MAX_MEDIA_SECONDS,
  parsePracticeConfig,
  type PracticeConfig,
} from "./config";
import type { CriterionResult } from "./scoring";

// Erreur montrée telle quelle à l'élève (français, sans détail technique).
export class PracticeError extends Error {}

export const PRACTICE_TYPES = ["PRACTICE_AI", "PRACTICE_HUMAN"] as const;

async function loadPracticeLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !PRACTICE_TYPES.includes(lesson.type as (typeof PRACTICE_TYPES)[number])) {
    throw new PracticeError("Exercice introuvable.");
  }
  return { lesson, config: parsePracticeConfig(lesson.config) };
}

async function assertCurrent(userId: string, lessonId: string) {
  try {
    await assertCanStartLesson(userId, lessonId);
  } catch (e) {
    if (e instanceof LessonLockedError) throw new PracticeError(e.message);
    throw e;
  }
}

// ---------- Envoi d'un fichier ----------

async function storeMedia(input: {
  ownerId: string;
  lessonId: string;
  originalName: string;
  body: Readable;
  allowed: ("video" | "audio")[];
  isReference: boolean;
}) {
  const ext = path.extname(input.originalName).toLowerCase();
  const kind = input.allowed.find((k) => ACCEPTED_EXTENSIONS[k].includes(ext));
  if (!kind) {
    const formats = input.allowed.flatMap((k) => ACCEPTED_EXTENSIONS[k]);
    throw new PracticeError(formats.length ? `Format non accepté. Formats possibles : ${formats.join(", ")}.` : "Cet exercice n'accepte pas de fichier.");
  }

  const id = randomUUID();
  const storageKey = `${input.isReference ? "references" : "submissions"}/${input.ownerId}/${id}${ext}`;
  let written;
  try {
    written = await writeStream(storageKey, input.body, MAX_FILE_BYTES);
  } catch (e) {
    if (e instanceof FileTooLargeError) throw new PracticeError("Fichier trop lourd : 200 Mo maximum.");
    throw e;
  }

  // Vérifie que c'est vraiment un média du bon type (pas seulement une extension).
  try {
    let info;
    try {
      info = await probe(filePath(storageKey));
    } catch (e) {
      if (e instanceof MediaError) throw new PracticeError("Fichier illisible. Exporte-le à nouveau puis réessaie.");
      throw e;
    }
    if (kind === "video" && !info.hasVideo) throw new PracticeError("Ce fichier ne contient pas de vidéo.");
    if (kind === "audio" && (info.hasVideo || !info.hasAudio)) throw new PracticeError("Ce fichier n'est pas un fichier audio.");
    if (info.durationSeconds > MAX_MEDIA_SECONDS + 0.5) throw new PracticeError("Trop long : 2 min 30 maximum.");

    const mimeType = kind === "video" ? (ext === ".mov" ? "video/quicktime" : ext === ".webm" ? "video/webm" : "video/mp4") : audioMime(ext);
    return await prisma.asset.create({
      data: {
        userId: input.ownerId,
        lessonId: input.lessonId,
        kind: kind === "video" ? "VIDEO" : "AUDIO",
        storageKey,
        originalName: input.originalName.slice(0, 200),
        mimeType,
        sizeBytes: written.sizeBytes,
        sha256: written.sha256,
        durationSeconds: info.durationSeconds,
        width: info.width,
        height: info.height,
        hasAudio: info.hasAudio,
        isReference: input.isReference,
      },
      select: { id: true, kind: true, originalName: true, sizeBytes: true, durationSeconds: true },
    });
  } catch (e) {
    await deleteFile(storageKey);
    throw e;
  }
}

// Fichier envoyé par l'élève pour l'exercice en cours.
export async function registerUpload(input: { userId: string; lessonId: string; originalName: string; body: Readable }) {
  await assertCurrent(input.userId, input.lessonId);
  const { config } = await loadPracticeLesson(input.lessonId);
  return storeMedia({
    ownerId: input.userId,
    lessonId: input.lessonId,
    originalName: input.originalName,
    body: input.body,
    allowed: (["video", "audio"] as const).filter((k) => config.accept.includes(k)),
    isReference: false,
  });
}

function audioMime(ext: string) {
  return ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "audio/mp4";
}

// ---------- Soumission ----------

const sha256 = (s: string) => createHash("sha256").update(s.trim()).digest("hex");

export async function submitPractice(userId: string, lessonId: string, input: { assetIds: string[]; text: string | null }) {
  await assertCurrent(userId, lessonId);
  const { config } = await loadPracticeLesson(lessonId);
  if (!isPracticeReady(config)) throw new PracticeError("Cet exercice n'est pas encore prêt. Reviens un peu plus tard.");

  const text = input.text?.trim() || null;
  if (text && text.length > 20_000) throw new PracticeError("Texte trop long.");
  const assets = input.assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: input.assetIds }, userId, lessonId, submissionId: null, deletedAt: null, isReference: false } })
    : [];
  if (assets.length !== new Set(input.assetIds).size) throw new PracticeError("Un fichier est introuvable. Renvoie-le.");

  const needVideo = config.accept.includes("video");
  const needAudio = config.accept.includes("audio");
  const needText = config.accept.includes("text");
  if (needVideo && assets.filter((a) => a.kind === "VIDEO").length !== 1) throw new PracticeError("Ajoute ta vidéo.");
  if (needAudio && assets.filter((a) => a.kind === "AUDIO").length !== 1) throw new PracticeError("Ajoute ton fichier audio.");
  if (!needVideo && !needAudio && assets.length) throw new PracticeError("Cet exercice n'accepte pas de fichier.");
  if (needText && !text) throw new PracticeError("Écris ton texte avant d'envoyer.");
  if (!needText && text) throw new PracticeError("Cet exercice n'accepte pas de texte.");

  const previous = await prisma.submission.findMany({
    where: { userId, lessonId },
    select: { status: true, textSha256: true, assets: { select: { sha256: true } } },
  });
  if (previous.some((s) => s.status === "PASSED" || s.status === "HUMAN_APPROVED")) throw new PracticeError("Tu as déjà validé cet exercice.");
  if (previous.some((s) => s.status === "PENDING_HUMAN")) throw new PracticeError("Un coach examine déjà ta réalisation.");

  // Même fichier (ou même texte) qu'avant = pas une nouvelle tentative.
  const oldHashes = new Set(previous.flatMap((s) => s.assets.map((a) => a.sha256)));
  const textHash = text ? sha256(text) : null;
  const sameFile = assets.some((a) => oldHashes.has(a.sha256));
  const sameText = textHash !== null && previous.some((s) => s.textSha256 === textHash);
  if (sameFile || (sameText && assets.length === 0)) {
    throw new PracticeError("Cette réalisation semble identique à ta précédente soumission. Envoie une nouvelle réalisation.");
  }

  let submission;
  try {
    submission = await prisma.$transaction(async (tx) => {
      const attemptNumber = (await tx.submission.count({ where: { userId, lessonId } })) + 1;
      const created = await tx.submission.create({
        data: {
          userId,
          lessonId,
          attemptNumber,
          text,
          textSha256: textHash,
          threshold: config.threshold,
          criteriaSnapshot: config.criteria as unknown as Prisma.InputJsonValue,
          status: "PENDING_HUMAN",
        },
      });
      await tx.asset.updateMany({ where: { id: { in: assets.map((a) => a.id) } }, data: { submissionId: created.id } });
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId, attemptCount: 1 },
        update: { attemptCount: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { actorUserId: userId, action: "SUBMISSION_CREATED", entityType: "submission", entityId: created.id, metadata: { lessonId, attemptNumber } },
      });
      return created;
    });
  } catch (e) {
    // Double envoi simultané : l'index unique (une seule analyse en cours) refuse le second.
    if ((e as { code?: string }).code === "P2002") throw new PracticeError("Ta réalisation est déjà en cours d'envoi.");
    throw e;
  }

  await pruneOldSubmissionFiles(userId, lessonId);
  await notifyGraders(submission.id);
  return submission;
}

// Correction à la main : les admins et les coachs sont prévenus (pendant la formation, l'élève n'a pas encore de coach).
async function notifyGraders(submissionId: string) {
  const s = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { user: { select: { displayName: true } }, lesson: { select: { title: true } } } });
  const staff = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COACH"] }, status: "ACTIVE" }, select: { id: true, role: true } });
  for (const u of staff) {
    await notify(u.id, {
      kind: "admin.humanReview",
      href: u.role === "ADMIN" ? `/admin/reviews/${s.id}` : `/coach/exercises/${s.id}`,
      text: `${s.user.displayName} a envoyé « ${s.lesson.title} » : à corriger.`,
    });
  }
}

// ---------- Vue élève ----------

export interface PracticeView {
  lessonId: string;
  title: string;
  summary: string;
  criteria: { instruction: string; pointsPerMiss: number }[]; // visibles par l'élève avant l'envoi
  accept: PracticeConfig["accept"];
  threshold: number;
  status: "NOT_READY" | "OPEN" | "PASSED" | "PENDING_HUMAN";
  submissions: {
    id: string;
    attemptNumber: number;
    status: string;
    score: number | null;
    feedback: string | null;
    criteria: CriterionResult[];
    createdAt: string;
    technicalFailures: number;
    files: { name: string; deleted: boolean }[];
    hasText: boolean;
    reviewComment: string | null;
  }[];
}

export async function getPracticeView(userId: string, lessonId: string): Promise<PracticeView> {
  const { lesson, config } = await loadPracticeLesson(lessonId);
  const submissions = await prisma.submission.findMany({
    where: { userId, lessonId },
    orderBy: { attemptNumber: "desc" },
    include: { assets: { select: { originalName: true, deletedAt: true } } },
  });
  const latest = submissions[0];
  const passed = submissions.some((s) => s.status === "PASSED" || s.status === "HUMAN_APPROVED");
  const status = passed
    ? "PASSED"
    : latest?.status === "PENDING_HUMAN"
      ? "PENDING_HUMAN"
      : isPracticeReady(config)
        ? "OPEN"
        : "NOT_READY";
  return {
    lessonId,
    title: lesson.title,
    summary: lesson.summary,
    criteria: config.criteria.map((c) => ({ instruction: c.instruction, pointsPerMiss: c.pointsPerMiss })),
    accept: config.accept,
    threshold: config.threshold,
    status,
    submissions: submissions.map((s) => ({
      id: s.id,
      attemptNumber: s.attemptNumber,
      status: s.status,
      score: s.score,
      feedback: s.feedback,
      criteria: (s.criteria as unknown as CriterionResult[] | null) ?? [],
      createdAt: s.createdAt.toISOString(),
      technicalFailures: s.technicalFailures,
      files: s.assets.map((a) => ({ name: a.originalName, deleted: Boolean(a.deletedAt) })),
      hasText: Boolean(s.text),
      reviewComment: s.reviewComment,
    })),
  };
}
