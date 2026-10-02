"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { normalizeTikTokUsername } from "@/server/coaching/rules";
import { resetProfilePhoto } from "@/server/profile/service";

type Result = { ok: true } | { ok: false; error: string };

export async function resetPhotoAction(): Promise<Result> {
  const user = await requireUser();
  await resetProfilePhoto(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function tiktokAction(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = z.string().max(40).safeParse(raw);
  const username = parsed.success ? normalizeTikTokUsername(parsed.data) : "";
  if (!/^[\w.]{2,24}$/.test(username)) return { ok: false, error: "Nom d'utilisateur TikTok invalide." };
  await prisma.user.update({ where: { id: user.id }, data: { tiktokUsername: username } });
  revalidatePath("/profil");
  return { ok: true };
}
