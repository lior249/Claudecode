"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createResultPost, reactToPost, ResultPostError, reviewResultPost } from "@/server/results/service";

type Result = { ok: true } | { ok: false; error: string };

async function guard(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ResultPostError) return { ok: false, error: e.message };
    console.error("[results]", e);
    return { ok: false, error: "Une erreur est survenue. Réessaie." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const postSchema = z.object({ title: z.string().max(200), body: z.string().max(3000), imageKey: z.string().max(200), link: z.string().max(500).optional() });

export async function createResultPostAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const d = postSchema.safeParse(raw);
  if (!d.success) return { ok: false, error: "Formulaire invalide." };
  return guard(() => createResultPost(user.id, d.data));
}

export async function reviewResultPostAction(raw: unknown): Promise<Result> {
  const user = await requireUser(["COACH", "ADMIN"]);
  const d = z.object({ postId: z.string().max(64), approve: z.boolean(), comment: z.string().max(2000).default("") }).safeParse(raw);
  if (!d.success) return { ok: false, error: "Formulaire invalide." };
  return guard(() => reviewResultPost(user, d.data.postId, d.data.approve, d.data.comment));
}

export async function reactAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const d = z.object({ postId: z.string().max(64), kind: z.enum(["FIRE", "ROCKET", "ANGRY", "CRY"]).nullable() }).safeParse(raw);
  if (!d.success) return { ok: false, error: "Réaction invalide." };
  return guard(() => reactToPost(user.id, d.data.postId, d.data.kind));
}
