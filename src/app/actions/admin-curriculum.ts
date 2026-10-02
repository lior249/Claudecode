"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import * as cur from "@/server/admin/curriculum";

type Result = { ok: true } | { ok: false; error: string };
const id = z.string().min(1).max(64);
const description = z.string().trim().max(2000).default("");
const kind = z.enum(["level", "module", "lesson"]);

// Vérifie le rôle, valide l'entrée, exécute, et renvoie une erreur lisible.
async function run<S extends z.ZodTypeAny>(schema: S, raw: unknown, fn: (adminId: string, data: z.infer<S>) => Promise<unknown>): Promise<Result> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  try {
    await fn(admin.id, parsed.data);
  } catch (e) {
    if (e instanceof cur.CurriculumError) return { ok: false, error: e.message };
    console.error("[curriculum]", e);
    return { ok: false, error: "Action impossible. Réessaie." };
  }
  revalidatePath("/admin");
  revalidatePath("/learn");
  return { ok: true };
}

export const createLevelAction = async (raw: unknown) =>
  run(z.object({ title: cur.title, description }), raw, (a, d) => cur.createLevel(a, d));

export const updateLevelAction = async (raw: unknown) =>
  run(z.object({ id, title: cur.title, description, isPublished: z.boolean() }), raw, (a, { id: i, ...d }) => cur.updateLevel(a, i, d));

export const createModuleAction = async (raw: unknown) =>
  run(z.object({ levelId: id, title: cur.title, description, whopUrl: cur.whopUrl }), raw, (a, d) => cur.createModule(a, d));

export const updateModuleAction = async (raw: unknown) =>
  run(z.object({ id, title: cur.title, description, whopUrl: cur.whopUrl, isPublished: z.boolean() }), raw, (a, { id: i, ...d }) =>
    cur.updateModule(a, i, d),
  );

export const createLessonAction = async (raw: unknown) =>
  run(
    z.object({
      moduleId: id,
      title: cur.title,
      type: z.enum(["UNDERSTANDING", "PRACTICE_AI", "DECISION", "CODE_VALIDATION"]),
      catalog: z.enum(["niches", "countries", "methods10k"]).optional(),
    }),
    raw,
    (a, d) => cur.createLesson(a, d),
  );

export const updateLessonAction = async (raw: unknown) =>
  run(z.object({ id, title: cur.title, isPublished: z.boolean() }), raw, (a, { id: i, ...d }) => cur.updateLesson(a, i, d));

export const removeAction = async (raw: unknown) =>
  run(z.object({ kind, id }), raw, (a, d) =>
    d.kind === "level" ? cur.deleteLevel(a, d.id) : d.kind === "module" ? cur.deleteModule(a, d.id) : cur.deleteLesson(a, d.id),
  );

export const moveAction = async (raw: unknown) =>
  run(z.object({ kind, id, direction: z.enum(["up", "down"]) }), raw, (a, d) => cur.move(a, d.kind, d.id, d.direction));
