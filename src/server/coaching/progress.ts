import "server-only";
import { prisma } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { STREAK_MILESTONES, streakMilestone } from "@/server/notifications/rules";
import { fileUrl } from "@/server/decisions/service";
import { resultPointsTotal } from "@/server/results/service";
import { CoachingError } from "./lifecycle";
import {
  computeStreak,
  isValidTimezone,
  localDate,
  monthlyWindow,
  normalizeTikTokUsername,
  parseTikTokUrl,
  activityGrid,
  type AnyRank,
} from "./rules";
import { leaderboardWhere } from "./team";

const tzOf = (u: { timezone: string | null }) => (u.timezone && isValidTimezone(u.timezone) ? u.timezone : "UTC");

async function coachingLearner(learnerId: string) {
  const l = await prisma.user.findUnique({ where: { id: learnerId } });
  if (!l || l.coachingStatus !== "ACTIVE") throw new CoachingError("Ton espace coaching n'est pas actif.");
  return l;
}

// ---------- Profil ----------

export async function updateCoachingProfile(learnerId: string, input: { tiktokUsername: string; timezone: string }) {
  const username = normalizeTikTokUsername(input.tiktokUsername);
  if (!/^[\w.]{2,24}$/.test(username)) throw new CoachingError("Nom d'utilisateur TikTok invalide.");
  if (!isValidTimezone(input.timezone)) throw new CoachingError("Fuseau horaire invalide.");
  await prisma.user.update({ where: { id: learnerId }, data: { tiktokUsername: username, timezone: input.timezone } });
}

// ---------- Posts (streak) ----------

export async function addPost(learnerId: string, url: string, now = new Date()) {
  const l = await coachingLearner(learnerId);
  if (!l.tiktokUsername) throw new CoachingError("Indique d'abord ton nom d'utilisateur TikTok.");
  const parsed = parseTikTokUrl(url);
  if (!parsed) throw new CoachingError("Colle le lien complet de ta vidéo TikTok (tiktok.com/@ton_compte/video/…).");
  if (parsed.username !== l.tiktokUsername) throw new CoachingError(`Ce post n'est pas sur ton compte @${l.tiktokUsername}.`);
  if (parsed.postedAt.getTime() > now.getTime() + 5 * 60_000) throw new CoachingError("La date de ce post est invalide.");
  let post;
  try {
    post = await prisma.post.create({
      data: { learnerId, url: `https://www.tiktok.com/@${parsed.username}/video/${parsed.videoId}`, videoId: parsed.videoId, postedAt: parsed.postedAt, localDate: localDate(parsed.postedAt, tzOf(l)) },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new CoachingError("Ce post est déjà enregistré.");
    throw e;
  }
  const streak = await getStreak(learnerId, now);
  if (STREAK_MILESTONES.includes(streak.current)) {
    await notify(learnerId, {
      kind: "streak.milestone",
      href: "/coaching",
      onceKey: `streak-milestone:${streak.current}:${localDate(now, tzOf(l))}`,
      text: streakMilestone(streak.current),
    });
  }
  return post;
}

// Grille de régularité des 18 dernières semaines (jours postés, gels, jours manqués).
export async function getActivity(learnerId: string, now = new Date()) {
  const l = await prisma.user.findUniqueOrThrow({ where: { id: learnerId } });
  const tz = tzOf(l);
  const today = localDate(now, tz);
  const start = l.coachingStartedAt ? localDate(l.coachingStartedAt, tz) : today;
  const posts = (await prisma.post.findMany({ where: { learnerId }, select: { localDate: true } })).map((p) => p.localDate);
  const streak = computeStreak(posts, start, today);
  return activityGrid(posts, streak.frozenDays, start, today);
}

export async function getStreak(learnerId: string, now = new Date()) {
  const l = await prisma.user.findUniqueOrThrow({ where: { id: learnerId } });
  const tz = tzOf(l);
  const start = l.coachingStartedAt ? localDate(l.coachingStartedAt, tz) : localDate(now, tz);
  const posts = await prisma.post.findMany({ where: { learnerId }, select: { localDate: true } });
  return computeStreak(
    posts.map((p) => p.localDate),
    start,
    localDate(now, tz),
  );
}

// ---------- Points et classement ----------

// Points des résultats publiés (types de résultats définis par l'admin).
export const qualityPoints = (learnerId: string) => resultPointsTotal(learnerId);

export async function leaderboard(now = new Date()) {
  const learners = await prisma.user.findMany({
    where: leaderboardWhere,
    select: { id: true, displayName: true, avatarUrl: true, photoKey: true, tiktokUsername: true, manualRank: true },
  });
  const rows = [];
  for (const { photoKey, ...l } of learners) {
    const streak = await getStreak(l.id, now);
    const quality = await qualityPoints(l.id);
    rows.push({
      ...l,
      avatarUrl: photoKey ? fileUrl(photoKey) : l.avatarUrl,
      rank: (l.manualRank ?? "B") as AnyRank,
      streak: streak.current,
      flame: streak.flame,
      points: streak.points + quality,
    });
  }
  return rows.sort((a, b) => b.points - a.points || b.streak - a.streak || a.displayName.localeCompare(b.displayName));
}

// ---------- Tableau de bord de l'élève ----------

export async function getCoachingDashboard(learnerId: string, now = new Date()) {
  const l = await prisma.user.findUniqueOrThrow({ where: { id: learnerId }, include: { coach: { select: { displayName: true } } } });
  const tz = tzOf(l);
  const [streak, quality, posts, reactivation] = [
    await getStreak(learnerId, now),
    await qualityPoints(learnerId),
    await prisma.post.findMany({ where: { learnerId }, orderBy: { postedAt: "desc" }, take: 30 }),
    await prisma.reactivationRequest.findFirst({ where: { learnerId }, orderBy: { createdAt: "desc" } }),
  ];
  return {
    status: l.coachingStatus,
    coachName: l.coach?.displayName ?? null,
    tiktokUsername: l.tiktokUsername,
    timezone: l.timezone,
    rank: (l.manualRank ?? "B") as AnyRank,
    streak,
    activity: await getActivity(learnerId, now),
    points: { streak: streak.points, quality, total: streak.points + quality },
    posts: posts.map((p) => ({ id: p.id, url: p.url, localDate: p.localDate })),
    monthlyOpen: monthlyWindow(localDate(now, tz)).open,
    reactivation: reactivation ? { status: reactivation.status, createdAt: reactivation.createdAt.toISOString() } : null,
  };
}
export type CoachingDashboard = Awaited<ReturnType<typeof getCoachingDashboard>>;
