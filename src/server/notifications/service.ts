import "server-only";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { botConfigured, botSendDirectMessage } from "@/server/discord/api";
import { isValidTimezone, localDate } from "@/server/coaching/rules";
import { clampReminderHour, dmDecision, localHour } from "./rules";

export interface NotifyInput {
  kind: string;
  text: string;
  href?: string;
  /** Ignore les heures calmes et le plafond quotidien (délais qui tournent la nuit). */
  urgent?: boolean;
  /** false : seulement dans la cloche, pas de message privé Discord. */
  dm?: boolean;
  /** Clé unique par utilisateur : la notification n'est créée qu'une fois. */
  onceKey?: string;
}

// Enregistre un envoi unique : renvoie false s'il a déjà eu lieu.
export async function markReminder(userId: string, key: string) {
  try {
    await prisma.reminder.create({ data: { userId, key } });
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }
}

export const userTimezone = (u: { timezone: string | null }) =>
  u.timezone && isValidTimezone(u.timezone) ? u.timezone : getEnv().APP_TIMEZONE;

/**
 * Crée une notification (cloche). Le message privé Discord part ensuite avec le worker,
 * qui respecte les heures calmes et le plafond du jour. Ne lève jamais d'erreur :
 * une notification ratée ne doit pas bloquer l'action qui l'a déclenchée.
 */
export async function notify(userId: string, input: NotifyInput) {
  try {
    if (input.onceKey && !(await markReminder(userId, input.onceKey))) return null;
    return await prisma.notification.create({
      data: {
        userId,
        kind: input.kind,
        text: input.text,
        href: input.href ?? null,
        urgent: input.urgent ?? false,
        dmStatus: input.dm === false ? "SKIPPED" : "PENDING",
      },
    });
  } catch (e) {
    console.error("[notify] notification non créée", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "onceKey">) {
  for (const id of userIds) await notify(id, input);
}

export async function notifyAdmins(input: Omit<NotifyInput, "onceKey">) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  await notifyMany(admins.map((a) => a.id), input);
}

// ---------- Messages privés Discord (worker) ----------

const DM_BATCH = 50;

export async function deliverPendingDms(now = new Date()) {
  const pending = await prisma.notification.findMany({
    where: { dmStatus: "PENDING" },
    orderBy: [{ urgent: "desc" }, { createdAt: "asc" }],
    take: DM_BATCH,
    include: { user: { select: { discordUserId: true, timezone: true, dmEnabled: true, status: true } } },
  });
  const bot = botConfigured();
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  let sent = 0;
  for (const n of pending) {
    const u = n.user;
    const reachable = bot && u.discordUserId && u.status === "ACTIVE" && (u.dmEnabled || n.urgent);
    if (!reachable) {
      await prisma.notification.update({ where: { id: n.id }, data: { dmStatus: "SKIPPED" } });
      continue;
    }
    const tz = userTimezone(u);
    const today = localDate(now, tz);
    const recent = await prisma.notification.findMany({
      where: { userId: n.userId, dmStatus: "SENT", urgent: false, dmSentAt: { gte: new Date(now.getTime() - 26 * 3_600_000) } },
      select: { dmSentAt: true },
    });
    const sentToday = recent.filter((r) => r.dmSentAt && localDate(r.dmSentAt, tz) === today).length;
    const decision = dmDecision({ urgent: n.urgent, hour: localHour(now, tz), sentToday, ageMs: now.getTime() - n.createdAt.getTime() });
    if (decision === "wait") continue;
    if (decision === "skip") {
      await prisma.notification.update({ where: { id: n.id }, data: { dmStatus: "SKIPPED" } });
      continue;
    }
    try {
      await botSendDirectMessage(u.discordUserId!, n.href ? `${n.text}\n${appUrl}${n.href}` : n.text);
      await prisma.notification.update({ where: { id: n.id }, data: { dmStatus: "SENT", dmSentAt: now } });
      sent++;
    } catch (e) {
      // Messages privés fermés, bot hors du serveur… : on n'insiste pas, la cloche suffit.
      console.error("[notify] message Discord non envoyé", e instanceof Error ? e.message : e);
      await prisma.notification.update({ where: { id: n.id }, data: { dmStatus: "FAILED" } });
    }
  }
  return sent;
}

// ---------- Cloche ----------

export const unreadCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });

export function listNotifications(userId: string, take = 60) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function markAllRead(userId: string, now = new Date()) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}

export async function updateNotificationSettings(userId: string, input: { reminderHour: number; dmEnabled: boolean }) {
  await prisma.user.update({ where: { id: userId }, data: { reminderHour: clampReminderHour(input.reminderHour), dmEnabled: input.dmEnabled } });
}

// Fuseau du téléphone, enregistré dès la première visite (s'il n'est pas déjà connu).
export async function saveTimezoneIfMissing(userId: string, tz: string) {
  if (!isValidTimezone(tz)) return;
  await prisma.user.updateMany({ where: { id: userId, timezone: null }, data: { timezone: tz } });
}

// Les vieilles notifications lues sont supprimées (la cloche reste légère).
export async function pruneNotifications(now = new Date()) {
  const { count } = await prisma.notification.deleteMany({ where: { readAt: { lt: new Date(now.getTime() - 60 * 86_400_000) } } });
  return count;
}
