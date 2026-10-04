import "server-only";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { fileUrl } from "@/server/decisions/service";
import { getLearnerProgression } from "@/server/learn/service";
import { getActivity, getStreak, qualityPoints } from "@/server/coaching/progress";
import { localDate, type AnyRank } from "@/server/coaching/rules";
import { userTimezone } from "@/server/notifications/service";
import { storeAvatarImage } from "@/server/storage/images";
import { deleteAvatarFile } from "@/server/retention/service";
import { listResultPosts, monthlyRevenues } from "@/server/results/service";

// Photo affichée : celle choisie sur Creato, sinon celle de Discord.
export const avatarOf = (u: { photoKey: string | null; avatarUrl: string | null }) => (u.photoKey ? fileUrl(u.photoKey) : u.avatarUrl);

export async function setProfilePhoto(userId: string, body: Readable) {
  const key = await storeAvatarImage(body);
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { photoKey: true } });
  await prisma.user.update({ where: { id: userId }, data: { photoKey: key } });
  await deleteAvatarFile(before.photoKey);
  return fileUrl(key);
}

export async function resetProfilePhoto(userId: string) {
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { photoKey: true } });
  await prisma.user.update({ where: { id: userId }, data: { photoKey: null } });
  await deleteAvatarFile(before.photoKey);
}

const bestOf = (months: { amountEur: number }[]) => months.reduce((m, r) => Math.max(m, r.amountEur), 0);

// Mois civil précédent (AAAA-MM) dans le fuseau de la personne.
export function previousMonth(today: string) {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

// Fiche publique d'un membre du classement (pas de captures, pas de remarques, pas de niche).
export async function memberCard(userId: string, now = new Date(), viewerId: string = userId) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const streak = await getStreak(userId, now);
  const quality = await qualityPoints(userId);
  const months = await monthlyRevenues(userId);
  return {
    id: u.id,
    displayName: u.displayName,
    avatarUrl: avatarOf(u),
    rank: (u.manualRank ?? "B") as AnyRank,
    points: streak.points + quality,
    coachingSince: u.coachingStartedAt?.toISOString() ?? null,
    streak: { current: streak.current, best: streak.best, flame: streak.flame },
    activity: await getActivity(userId, now),
    lastMonthEur: months.find((x) => x.month === previousMonth(localDate(now, userTimezone(u))))?.amountEur ?? 0,
    bestMonthEur: bestOf(months),
    totalEur: months.reduce((sum, x) => sum + x.amountEur, 0),
    months,
    posts: await listResultPosts(userId, viewerId),
  };
}
export type MemberCard = Awaited<ReturnType<typeof memberCard>>;

// Mon profil : ma fiche (sans les remarques réservées aux coachs) + mes réglages.
export async function myProfile(userId: string, now = new Date()) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { progression } = await getLearnerProgression(userId, now, { startClock: false });
  const inCoaching = u.coachingStatus !== "NONE";
  const card = inCoaching ? await memberCard(userId, now, userId) : null;
  return {
    displayName: u.displayName,
    avatarUrl: avatarOf(u),
    hasCustomPhoto: Boolean(u.photoKey),
    discordUsername: u.discordUsername,
    rank: card?.rank ?? progression.rank,
    joinedAt: u.createdAt.toISOString(),
    percent: progression.percent,
    inCoaching,
    coaching: card,
    tiktokUsername: u.tiktokUsername,
    reminderHour: u.reminderHour,
    dmEnabled: u.dmEnabled,
  };
}
export type MyProfile = Awaited<ReturnType<typeof myProfile>>;

// Vues accessibles selon le rôle (menu « Changer de vue »).
export function viewsFor(u: { role: string; coachingStatus: string }) {
  // Vue élève : le coaching pour un élève qui y est, sinon la formation (l'équipe y trouve le bouton « Coaching »).
  const views: { href: string; label: string }[] = [{ href: u.role === "LEARNER" && u.coachingStatus !== "NONE" ? "/coaching" : "/learn", label: "Élève" }];
  if (u.role === "COACH" || u.role === "ADMIN") views.push({ href: "/coach", label: "Coach" });
  if (u.role === "ADMIN") views.push({ href: "/admin", label: "Admin" });
  return views;
}
