"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { generateValidationCode } from "@/lib/codes";

const input = z.object({
  lessonId: z.string().min(1).max(64),
  summary: z.string().trim().max(4000),
  phrase: z.string().trim().min(1, "Écris la phrase de validation.").max(300),
  code: z
    .string()
    .trim()
    .min(4, "Le code fait au moins 4 caractères.")
    .max(40)
    .regex(/^[A-Za-z0-9]+$/, "Le code ne contient que des lettres et des chiffres."),
  questions: z.array(z.string().trim().min(1).max(300)).min(1, "Ajoute au moins une question.").max(20),
  afterMessage: z.string().trim().max(2000),
});

export async function saveLaunchConfig(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const { lessonId, summary, ...config } = parsed.data;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.type !== "CODE_VALIDATION") return { ok: false, error: "Étape introuvable." };
  await prisma.lesson.update({ where: { id: lessonId }, data: { summary, config: { ...config, code: config.code.toUpperCase() } } });
  await prisma.auditLog.create({ data: { actorUserId: admin.id, action: "LAUNCH_CONFIG_EDITED", entityType: "lesson", entityId: lessonId } });
  revalidatePath(`/admin/launch/${lessonId}`);
  return { ok: true };
}

export async function newLaunchCode() {
  await requireUser(["ADMIN"]);
  return generateValidationCode();
}
