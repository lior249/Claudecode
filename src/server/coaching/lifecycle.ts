import "server-only";
import { prisma } from "@/server/db";
import { enqueue } from "@/server/jobs/queue";
import { notify } from "@/server/notifications/service";
import { botConfigured, botRemoveRole } from "@/server/discord/api";
import { getEnv } from "@/server/env";
import { markReminder } from "@/server/notifications/service";
import { ABSENCE_DAYS, ABSENCE_WARNING_DAYS } from "./rules";
import { isTeam } from "./team";

export class CoachingError extends Error {}

// Coachs = utilisateurs avec un ordre de coach (coachOrder), rôle COACH ou ADMIN.
export async function listCoachesWithLoad() {
  const coaches = await prisma.user.findMany({
    where: { coachOrder: { not: null }, role: { in: ["COACH", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, displayName: true, coachOrder: true, coachCapacity: true, coachStars: true, avatarUrl: true },
  });
  const rows = [];
  for (const c of coaches) {
    const active = await prisma.user.count({ where: { coachId: c.id, coachingStatus: "ACTIVE" } });
    rows.push({ ...c, active, free: Math.max(0, c.coachCapacity - active) });
  }
  return rows;
}

// Le coach qui a le plus d'étoiles et une place libre (à égalité : l'ordre des coachs).
export function pickCoachByStars(coaches: { id: string; coachStars: number; coachOrder: number | null; free: number }[]) {
  return (
    [...coaches]
      .filter((c) => c.free > 0)
      .sort((a, b) => b.coachStars - a.coachStars || (a.coachOrder ?? 99) - (b.coachOrder ?? 99))[0]?.id ?? null
  );
}

// Entrée en coaching (après la validation du lancement, ou une réactivation acceptée).
export async function startCoaching(learnerId: string, preferredCoachId?: string | null) {
  const who = await prisma.user.findUniqueOrThrow({ where: { id: learnerId }, select: { role: true } });
  if (isTeam(who)) {
    // Un coach ou un admin qui termine la formation : pas de coach, juste son espace posts / résultats.
    await prisma.user.update({ where: { id: learnerId }, data: { coachingStatus: "ACTIVE", coachingStartedAt: new Date(), coachingEndedAt: null, coachId: null } });
    await enqueue("discord.grantElite", { userId: learnerId }, new Date(), 8);
    return null;
  }
  const coaches = await listCoachesWithLoad();
  const preferred = preferredCoachId ? coaches.find((c) => c.id === preferredCoachId && c.free > 0) : undefined;
  const coachId = preferred?.id ?? pickCoachByStars(coaches);
  const learner = await prisma.user.update({
    where: { id: learnerId },
    data: { coachingStatus: "ACTIVE", coachingStartedAt: new Date(), coachingEndedAt: null, coachId },
  });
  await prisma.auditLog.create({ data: { actorUserId: learnerId, action: "COACHING_STARTED", entityType: "user", entityId: learnerId, metadata: { coachId } } });
  await enqueue("discord.grantElite", { userId: learnerId }, new Date(), 8);
  if (coachId) {
    await notify(coachId, { kind: "coach.newLearner", href: "/coach/learners", text: `${learner.displayName} entre en coaching avec toi. Sa fiche est sur Creato.` });
  } else {
    // Aucune place libre : les admins sont prévenus.
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const a of admins) await notify(a.id, { kind: "admin.noCoach", href: "/admin/coaches", text: `${learner.displayName} entre en coaching mais aucun coach n'a de place libre.` });
  }
  return coachId;
}

// Rang SSS validé : coaching terminé, la place se libère (le coach reste dans l'historique).
export async function completeCoaching(learnerId: string) {
  await prisma.user.update({ where: { id: learnerId }, data: { coachingStatus: "COMPLETED", coachingEndedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorUserId: learnerId, action: "COACHING_COMPLETED", entityType: "user", entityId: learnerId } });
  await notify(learnerId, { kind: "rank.sss", href: "/coaching", text: "Rang SSS ! Tu as atteint 1 000 € en un mois : ton coaching est officiellement terminé. Bravo !" });
}

// Dernier signe d'activité : dernier post déclaré, sinon le début du coaching.
async function lastActivity(learnerId: string, startedAt: Date) {
  const last = await prisma.post.findFirst({ where: { learnerId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return last && last.createdAt > startedAt ? last.createdAt : startedAt;
}

// Tâche quotidienne (élèves seulement) : rappels à J+4 et J+6 sans post, révocation à J+7.
export async function processAbsences(now = new Date()) {
  const learners = await prisma.user.findMany({
    where: { coachingStatus: "ACTIVE", role: "LEARNER" },
    select: { id: true, displayName: true, coachingStartedAt: true, discordUserId: true },
  });
  let revoked = 0;
  for (const l of learners) {
    const since = await lastActivity(l.id, l.coachingStartedAt ?? now);
    const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
    if (days >= ABSENCE_DAYS) {
      await revokeCoaching(l.id, now);
      revoked++;
      continue;
    }
    for (const w of ABSENCE_WARNING_DAYS) {
      if (days >= w && (await markReminder(l.id, `absence${w}:${since.toISOString()}`))) {
        await notify(l.id, { kind: "coaching.absence", href: "/coaching", text: `Aucun post depuis ${days} jours. Au bout de ${ABSENCE_DAYS} jours sans post, ta place de coaching est retirée. Ajoute ton post du jour sur Creato !` });
      }
    }
  }
  return revoked;
}

export async function revokeCoaching(learnerId: string, now = new Date()) {
  const l = await prisma.user.update({
    where: { id: learnerId },
    data: { coachingStatus: "REVOKED", coachingEndedAt: now, coachId: null, eliteGrantedAt: null },
  });
  await prisma.auditLog.create({ data: { action: "COACHING_REVOKED", entityType: "user", entityId: learnerId, metadata: { reason: "absence" } } });
  const roleId = getEnv().DISCORD_ROLE_ELITE_ID;
  if (l.discordUserId && roleId && botConfigured()) {
    await botRemoveRole(l.discordUserId, roleId).catch((e) => console.error("[coaching] retrait @Élite impossible", e));
  }
  await notify(learnerId, { kind: "coaching.revoked", href: "/coaching", text: `Ton coaching a été mis en pause après ${ABSENCE_DAYS} jours sans post. Pour revenir, fais une demande de réactivation sur Creato.` });
}

// ---------- Réactivation ----------

export async function requestReactivation(learnerId: string, reason: string) {
  const l = await prisma.user.findUniqueOrThrow({ where: { id: learnerId } });
  if (l.coachingStatus !== "REVOKED") throw new CoachingError("Ton coaching n'est pas en pause.");
  if (reason.trim().length < 20) throw new CoachingError("Explique en quelques phrases la raison de ton absence (20 caractères minimum).");
  if (await prisma.reactivationRequest.findFirst({ where: { learnerId, status: "PENDING" } })) {
    throw new CoachingError("Ta demande est déjà en cours d'examen.");
  }
  await prisma.reactivationRequest.create({ data: { learnerId, reason: reason.trim().slice(0, 2000) } });
  // Prévenir le dernier coach et les admins.
  const lastStart = await prisma.auditLog.findFirst({
    where: { entityId: learnerId, action: "COACHING_STARTED" },
    orderBy: { createdAt: "desc" },
  });
  const formerCoach = (lastStart?.metadata as { coachId?: string } | null)?.coachId;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const id of new Set([formerCoach, ...admins.map((a) => a.id)].filter(Boolean) as string[])) {
    await notify(id, { kind: "coach.reactivation", href: "/coach/reactivations", text: `${l.displayName} demande à réactiver son coaching. À examiner sur Creato.` });
  }
}

export async function decideReactivation(deciderId: string, requestId: string, accept: boolean) {
  const req = await prisma.reactivationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") throw new CoachingError("Cette demande a déjà été traitée.");
  await prisma.reactivationRequest.update({
    where: { id: requestId },
    data: { status: accept ? "APPROVED" : "REJECTED", decidedAt: new Date(), decidedById: deciderId },
  });
  await prisma.auditLog.create({
    data: { actorUserId: deciderId, action: accept ? "REACTIVATION_APPROVED" : "REACTIVATION_REJECTED", entityType: "user", entityId: req.learnerId },
  });
  if (accept) {
    const decider = await prisma.user.findUnique({ where: { id: deciderId }, select: { coachOrder: true } });
    await startCoaching(req.learnerId, decider?.coachOrder != null ? deciderId : null);
    await notify(req.learnerId, { kind: "coaching.reactivated", href: "/coaching", text: "Ton coaching est réactivé. Bon retour !" });
  } else {
    await notify(req.learnerId, { kind: "coaching.reactivationRefused", href: "/coaching", text: "Ta demande de réactivation n'a pas été acceptée pour le moment. Contacte l'équipe sur Discord." });
  }
}
