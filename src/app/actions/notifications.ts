"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { markAllRead, saveTimezoneIfMissing, updateNotificationSettings } from "@/server/notifications/service";

export async function markAllReadAction() {
  const user = await requireUser();
  await markAllRead(user.id);
}

const settings = z.object({ reminderHour: z.number().int().min(0).max(23), dmEnabled: z.boolean() });

export async function notificationSettingsAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = settings.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Réglages invalides." };
  await updateNotificationSettings(user.id, parsed.data);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function timezoneAction(raw: unknown) {
  const user = await requireUser();
  const tz = z.string().max(60).safeParse(raw);
  if (tz.success) await saveTimezoneIfMissing(user.id, tz.data);
}
