"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { checkLaunchKey, LaunchError, submitLaunch } from "@/server/launch/service";

type Result = { ok: true } | { ok: false; error: string };
const key = z.object({ lessonId: z.string().min(1).max(64), phrase: z.string().max(300), code: z.string().max(60) });

async function guard(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof LaunchError) return { ok: false, error: e.message };
    console.error("[launch]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
}

export async function checkLaunchKeyAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const input = key.safeParse(raw);
  if (!input.success) return { ok: false, error: "Remplis la phrase et le code." };
  return guard(() => checkLaunchKey(user.id, input.data.lessonId, input.data.phrase, input.data.code));
}

export async function submitLaunchAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const input = key.extend({ answers: z.array(z.string().max(5000)).max(20) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Formulaire invalide." };
  const res = await guard(() => submitLaunch(user.id, input.data.lessonId, input.data));
  if (res.ok) revalidatePath("/learn", "layout");
  return res;
}
