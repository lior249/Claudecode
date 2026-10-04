"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { MAX_CRITERIA, MIN_CRITERIA, parsePracticeConfig } from "@/server/practice/config";
import type { Prisma } from "@/generated/prisma/client";

const input = z.object({
  lessonId: z.string().min(1).max(64),
  summary: z.string().trim().max(4000),
  accept: z.array(z.enum(["video", "audio", "text"])).min(1, "Choisis au moins un type d'envoi."),
  criteria: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        instruction: z.string().trim().min(1, "Chaque critère a besoin d'une consigne.").max(2000),
        pointsPerMiss: z.number({ message: "Indique les points retirés." }).min(0.5, "0,5 point minimum.").max(10, "10 points maximum."),
      }),
    )
    .min(MIN_CRITERIA, "Ajoute au moins un critère.")
    .max(MAX_CRITERIA, `${MAX_CRITERIA} critères maximum.`),
});

export async function savePracticeConfig(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const data = parsed.data;

  const lesson = await prisma.lesson.findUnique({ where: { id: data.lessonId } });
  if (!lesson || (lesson.type !== "PRACTICE_AI" && lesson.type !== "PRACTICE_HUMAN")) return { ok: false, error: "Exercice introuvable." };
  const current = parsePracticeConfig(lesson.config);

  const config = {
    threshold: current.threshold,
    accept: data.accept,
    criteria: data.criteria.map((c) => ({
      id: c.id && /^[\w-]{1,40}$/.test(c.id) ? c.id : randomUUID().slice(0, 8),
      instruction: c.instruction,
      pointsPerMiss: c.pointsPerMiss,
    })),
  };
  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { summary: data.summary, config: config as unknown as Prisma.InputJsonValue },
  });
  await prisma.auditLog.create({
    data: { actorUserId: admin.id, action: "PRACTICE_EDITED", entityType: "lesson", entityId: lesson.id, metadata: { criteria: config.criteria.length } },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/practice/${lesson.id}`);
  return { ok: true };
}
