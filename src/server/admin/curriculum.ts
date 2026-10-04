import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import type { LessonType } from "@/generated/prisma/enums";
import { generateValidationCode } from "@/lib/codes";
import { isPracticeReady, parsePracticeConfig } from "@/server/practice/config";

// Édition du parcours par l'Admin. Règle : une validation acquise reste acquise.
// Un élément qui a déjà de la progression ne se supprime pas : il se masque (dépublier).

export class CurriculumError extends Error {}

export const title = z.string().trim().min(1, "Le titre est obligatoire.").max(120);
export const whopUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u === "" || /^https:\/\//i.test(u), "Le lien Whop doit commencer par https://")
  .transform((u) => u || null);

async function audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await prisma.auditLog.create({ data: { actorUserId: actorId, action, entityType, entityId, metadata: metadata as object } });
}

// ---------- Niveaux ----------

export async function createLevel(actorId: string, data: { title: string; description: string }) {
  const position = ((await prisma.level.aggregate({ _max: { position: true } }))._max.position ?? 0) + 1;
  const level = await prisma.level.create({ data: { ...data, position } });
  await audit(actorId, "LEVEL_CREATED", "level", level.id);
  return level;
}

export async function updateLevel(actorId: string, id: string, data: { title: string; description: string; isPublished: boolean }) {
  await prisma.level.update({ where: { id }, data });
  await audit(actorId, "LEVEL_UPDATED", "level", id);
}

export async function deleteLevel(actorId: string, id: string) {
  if (await prisma.module.count({ where: { levelId: id } })) throw new CurriculumError("Supprime ou déplace d'abord les modules de ce niveau.");
  await prisma.level.delete({ where: { id } });
  await audit(actorId, "LEVEL_DELETED", "level", id);
}

// ---------- Modules ----------

export async function createModule(actorId: string, data: { levelId: string; title: string; description: string; whopUrl: string | null }) {
  const position = ((await prisma.module.aggregate({ where: { levelId: data.levelId }, _max: { position: true } }))._max.position ?? 0) + 1;
  const mod = await prisma.module.create({ data: { ...data, position } });
  await audit(actorId, "MODULE_CREATED", "module", mod.id);
  return mod;
}

export async function updateModule(actorId: string, id: string, data: { title: string; description: string; whopUrl: string | null; isPublished: boolean }) {
  await prisma.module.update({ where: { id }, data });
  await audit(actorId, "MODULE_UPDATED", "module", id, { whopUrl: data.whopUrl ? "défini" : "vide" });
}

export async function deleteModule(actorId: string, id: string) {
  if (await prisma.lesson.count({ where: { moduleId: id } })) throw new CurriculumError("Supprime d'abord les leçons de ce module.");
  await prisma.module.delete({ where: { id } });
  await audit(actorId, "MODULE_DELETED", "module", id);
}

// ---------- Leçons ----------

function defaultConfig(type: LessonType): object {
  switch (type) {
    case "PRACTICE_AI":
    case "PRACTICE_HUMAN":
      return { threshold: 8, accept: ["video"], criteria: [] };
    case "DECISION":
      return { catalog: "niches" };
    case "CODE_VALIDATION":
      return { phrase: "J'ai validé le module à 100 %", code: generateValidationCode() };
    default:
      return {};
  }
}

export async function createLesson(actorId: string, data: { moduleId: string; title: string; type: LessonType; catalog?: string }) {
  const position = ((await prisma.lesson.aggregate({ where: { moduleId: data.moduleId }, _max: { position: true } }))._max.position ?? 0) + 1;
  const config = data.type === "DECISION" && data.catalog ? { catalog: data.catalog } : defaultConfig(data.type);
  // Une nouvelle leçon est créée masquée : elle n'apparaît aux élèves qu'une fois prête et publiée.
  const lesson = await prisma.lesson.create({
    data: { moduleId: data.moduleId, title: data.title, type: data.type, position, config, isPublished: false },
  });
  await audit(actorId, "LESSON_CREATED", "lesson", lesson.id, { type: data.type });
  return lesson;
}

export async function updateLesson(actorId: string, id: string, data: { title: string; isPublished: boolean }) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id } });
  // Un exercice pratique ne devient visible qu'avec 1 à 3 critères.
  if (data.isPublished && !lesson.isPublished && (lesson.type === "PRACTICE_AI" || lesson.type === "PRACTICE_HUMAN") && !isPracticeReady(parsePracticeConfig(lesson.config))) {
    throw new CurriculumError("Ajoute au moins un critère (3 au maximum) avant de rendre cet exercice visible.");
  }
  await prisma.lesson.update({ where: { id }, data });
  await audit(actorId, "LESSON_UPDATED", "lesson", id, { isPublished: data.isPublished });
}

export async function deleteLesson(actorId: string, id: string) {
  const used =
    (await prisma.lessonProgress.count({ where: { lessonId: id } })) +
    (await prisma.submission.count({ where: { lessonId: id } })) +
    (await prisma.quizAttempt.count({ where: { lessonId: id } })) +
    (await prisma.decisionResponse.count({ where: { lessonId: id } })) +
    (await prisma.launchReport.count({ where: { lessonId: id } }));
  if (used) throw new CurriculumError("Des élèves ont déjà travaillé sur cette leçon : masque-la plutôt que de la supprimer.");
  await prisma.$transaction(async (tx) => {
    await tx.quizQuestion.deleteMany({ where: { lessonId: id } });
    await tx.asset.deleteMany({ where: { lessonId: id, isReference: true } });
    await tx.lesson.delete({ where: { id } });
  });
  await audit(actorId, "LESSON_DELETED", "lesson", id);
}

// ---------- Ordre (monter / descendre) ----------

type Kind = "level" | "module" | "lesson";

export async function move(actorId: string, kind: Kind, id: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx) => {
    const siblings =
      kind === "level"
        ? await tx.level.findMany({ orderBy: { position: "asc" }, select: { id: true } })
        : kind === "module"
          ? await tx.module.findMany({
              where: { levelId: (await tx.module.findUniqueOrThrow({ where: { id } })).levelId },
              orderBy: { position: "asc" },
              select: { id: true },
            })
          : await tx.lesson.findMany({
              where: { moduleId: (await tx.lesson.findUniqueOrThrow({ where: { id } })).moduleId },
              orderBy: { position: "asc" },
              select: { id: true },
            });
    const ids = siblings.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    // Renumérotation séquentielle (pas de Promise.all dans une transaction).
    for (const [index, sid] of ids.entries()) {
      if (kind === "level") await tx.level.update({ where: { id: sid }, data: { position: index + 1 } });
      else if (kind === "module") await tx.module.update({ where: { id: sid }, data: { position: index + 1 } });
      else await tx.lesson.update({ where: { id: sid }, data: { position: index + 1 } });
    }
  });
  await audit(actorId, "CURRICULUM_REORDERED", kind, id, { direction });
}
