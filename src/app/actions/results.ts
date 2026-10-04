"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createResult, reactToPost, ResultPostError, reviewResult } from "@/server/results/service";
import { deleteResultType, moveResultType, ResultTypeError, resultTypeInput, saveResultType } from "@/server/results/types-admin";

type Result = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ResultPostError || e instanceof ResultTypeError) return { ok: false, error: e.message };
    console.error("[results]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const postSchema = z.object({
  typeId: z.string().max(64),
  title: z.string().max(200),
  body: z.string().max(3000),
  imageKey: z.string().max(200),
  link: z.string().max(500).optional(),
});

export async function createResultAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const d = postSchema.safeParse(raw);
  if (!d.success) return { ok: false, error: "Formulaire invalide." };
  return guard(() => createResult(user.id, d.data));
}

export async function reviewResultAction(raw: unknown): Promise<Result> {
  const user = await requireUser(["COACH", "ADMIN"]);
  const d = z
    .object({ postId: z.string().max(64), approve: z.boolean(), metricValue: z.number().int().min(0).max(2_000_000_000).nullable().optional(), comment: z.string().max(2000).default("") })
    .safeParse(raw);
  if (!d.success) return { ok: false, error: "Formulaire invalide." };
  return guard(() => reviewResult(user, d.data.postId, d.data));
}

// ---------- Types de résultats (admin) ----------

export async function saveResultTypeAction(raw: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const d = resultTypeInput.safeParse(raw);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Formulaire invalide." };
  let id = "";
  const res = await guard(async () => {
    id = (await saveResultType(admin.id, d.data)).id;
  });
  return res.ok ? { ok: true, id } : res;
}

export async function deleteResultTypeAction(id: string): Promise<{ ok: true; hidden: boolean } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  let hidden = false;
  const res = await guard(async () => {
    hidden = (await deleteResultType(admin.id, String(id).slice(0, 64))).hidden;
  });
  return res.ok ? { ok: true, hidden } : res;
}

export async function moveResultTypeAction(id: string, dir: number): Promise<Result> {
  const admin = await requireUser(["ADMIN"]);
  return guard(() => moveResultType(admin.id, String(id).slice(0, 64), dir < 0 ? -1 : 1));
}

export async function reactAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const d = z.object({ postId: z.string().max(64), kind: z.enum(["FIRE", "ROCKET", "ANGRY", "CRY"]).nullable() }).safeParse(raw);
  if (!d.success) return { ok: false, error: "Réaction invalide." };
  return guard(() => reactToPost(user.id, d.data.postId, d.data.kind));
}
