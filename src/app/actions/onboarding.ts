"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { completeOnboarding, removeOnboardingVideo } from "@/server/onboarding/service";

export async function completeOnboardingAction(): Promise<{ ok: true }> {
  const user = await requireUser();
  await completeOnboarding(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeOnboardingVideoAction(): Promise<{ ok: true }> {
  const admin = await requireUser(["ADMIN"]);
  await removeOnboardingVideo(admin.id);
  revalidatePath("/admin/accueil");
  return { ok: true };
}
