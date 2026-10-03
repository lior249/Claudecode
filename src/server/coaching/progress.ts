import "server-only";
import { prisma } from "@/server/db";
import { notify, notifyAdmins } from "@/server/notifications/service";
import { STREAK_MILESTONES, streakMilestone } from "@/server/notifications/rules";
import { fileUrl } from "@/server/decisions/service";
import { USER_IMAGE_KEY } from "@/server/storage/images";
import type { ManualRank } from "@/generated/prisma/enums";
import { CoachingError, completeCoaching } from "./lifecycle";
import {
  computeStreak,
  FOLLOWERS_FOR_A,
  isValidTimezone,
  localDate,
  maxRank,
  monthlyWindow,
  normalizeTikTokUsername,
  parseTikTokUrl,
  activityGrid,
  rankFromMonthlyAmount,
  viewPoints,
  type AnyRank,
} from "./rules";
import { leaderboardWhere } from "./team";

const tzOf = (u: { timezone: string | null }) => (u.timezone && isValidTimezone(u.timezone) ? u.timezone : "UTC");

function assertOwnImage(learnerId: string, key: string) {
  if (USER_IMAGE_KEY.exec(key)?.[1] !== learnerId) throw new CoachingError("Ajoute ta capture d'écran.");
}

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

// ---------- Preuves ----------

export interface VideoStats {
  views: number;
  likes: number;
  comments: number;
}

const isCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 2_000_000_000;

export async function submitViewProof(learnerId: string, postId: string, stats: VideoStats, imageKey: string) {
  await coachingLearner(learnerId);
  assertOwnImage(learnerId, imageKey);
  const { views, likes, comments } = stats;
  if (![views, likes, comments].every(isCount)) throw new CoachingError("Indique les vues, les likes et les commentaires.");
  const post = await prisma.post.findFirst({ where: { id: postId, learnerId } });
  if (!post) throw new CoachingError("Vidéo introuvable.");
  if (!Number.isInteger(views) || views < 10_000) throw new CoachingError("Les points commencent à 10 000 vues.");
  if (viewPoints(views) <= viewPoints(post.validatedViews ?? 0)) throw new CoachingError("Cette vidéo a déjà ses points pour ce palier.");
  if (await prisma.viewProof.findFirst({ where: { postId, status: "PENDING" } })) throw new CoachingError("Une capture est déjà en attente pour cette vidéo.");
  await prisma.viewProof.create({ data: { postId, views, likes, comments, imageKey } });
  await notifyCoach(learnerId, "📊 Nouvelle capture de vues à valider.");
}

export async function submitFollowersProof(learnerId: string, followers: number, imageKey: string) {
  await coachingLearner(learnerId);
  assertOwnImage(learnerId, imageKey);
  if (followers < FOLLOWERS_FOR_A) throw new CoachingError("Le rang A demande 10 000 abonnés.");
  await assertNoPending(learnerId, "FOLLOWERS_10K");
  await prisma.rankProof.create({ data: { learnerId, kind: "FOLLOWERS_10K", followers, imageKey } });
  await notifyCoach(learnerId, "⭐ Nouvelle preuve « 10 000 abonnés » à valider.");
}

// Liens des vidéos : 1 à 10, sur le compte TikTok de l'élève.
function ownVideoUrls(username: string | null, urls: string[]) {
  const clean = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (clean.length < 1) throw new CoachingError("Ajoute le lien d'au moins une vidéo qui t'a rapporté de l'argent.");
  if (clean.length > 10) throw new CoachingError("10 liens maximum.");
  return clean.map((u) => {
    const p = parseTikTokUrl(u);
    if (!p) throw new CoachingError(`Lien invalide : ${u.slice(0, 80)}`);
    if (username && p.username !== username) throw new CoachingError(`Cette vidéo n'est pas sur ton compte @${username}.`);
    return `https://www.tiktok.com/@${p.username}/video/${p.videoId}`;
  });
}

export async function submitMonthlyProof(learnerId: string, amountEur: number, videoUrls: string[], imageKey: string, now = new Date(), description = "") {
  const l = await coachingLearner(learnerId);
  assertOwnImage(learnerId, imageKey);
  const links = ownVideoUrls(l.tiktokUsername, videoUrls);
  const window = monthlyWindow(localDate(now, tzOf(l)));
  if (!window.open || !window.month) throw new CoachingError("Les résultats du mois s'envoient uniquement le dernier jour du mois.");
  if (!Number.isInteger(amountEur) || amountEur < 0 || amountEur > 1_000_000) throw new CoachingError("Montant invalide.");
  if (await prisma.rankProof.findFirst({ where: { learnerId, kind: "MONTHLY", month: window.month, status: { in: ["PENDING", "APPROVED"] } } })) {
    throw new CoachingError("Tes résultats de ce mois sont déjà envoyés.");
  }
  const text = description.trim().slice(0, 1500);
  await prisma.rankProof.create({ data: { learnerId, kind: "MONTHLY", month: window.month, amountEur, videoUrls: links, imageKey, description: text || null } });
  await notifyCoach(learnerId, `💶 Résultats du mois ${window.month} à valider.`);
}

async function assertNoPending(learnerId: string, kind: "FOLLOWERS_10K" | "MONTHLY") {
  if (await prisma.rankProof.findFirst({ where: { learnerId, kind, status: "PENDING" } })) throw new CoachingError("Une preuve est déjà en attente.");
}

async function notifyCoach(learnerId: string, message: string) {
  const l = await prisma.user.findUniqueOrThrow({ where: { id: learnerId }, select: { coachId: true, displayName: true, role: true } });
  if (l.coachId) await notify(l.coachId, { kind: "coach.proof", href: "/coach/proofs", text: `${message} (${l.displayName})` });
  // Preuve d'un coach : c'est l'admin qui valide (l'admin valide aussi les siennes).
  else if (l.role === "COACH") await notifyAdmins({ kind: "coach.proof", href: "/coach/proofs", text: `${message} (${l.displayName}, coach)` });
}

async function assertCoachOf(reviewer: { id: string; role: string }, learnerId: string) {
  if (reviewer.role === "ADMIN") return;
  const l = await prisma.user.findUnique({ where: { id: learnerId }, select: { coachId: true } });
  if (l?.coachId !== reviewer.id) throw new CoachingError("Preuve introuvable.");
}

// Validation par le coach (il peut corriger le chiffre lu sur la capture).
export async function reviewViewProof(
  reviewer: { id: string; role: string },
  proofId: string,
  approve: boolean,
  correctedViews?: number,
  comment = "",
  verified = false,
) {
  const proof = await prisma.viewProof.findUnique({ where: { id: proofId }, include: { post: true } });
  if (!proof || proof.status !== "PENDING") throw new CoachingError("Cette preuve a déjà été traitée.");
  if (approve && !verified) throw new CoachingError("Vérifie que la vidéo, la capture et les chiffres concordent avant de valider.");
  if (!approve && !comment.trim()) throw new CoachingError("Explique à l'élève pourquoi tu refuses.");
  await assertCoachOf(reviewer, proof.post.learnerId);
  const views = approve ? (correctedViews ?? proof.views) : proof.views;
  await prisma.viewProof.update({
    where: { id: proofId },
    data: { status: approve ? "APPROVED" : "REJECTED", views, reviewComment: comment || null, reviewedAt: new Date(), reviewedById: reviewer.id },
  });
  if (approve && views > (proof.post.validatedViews ?? 0)) {
    await prisma.post.update({ where: { id: proof.postId }, data: { validatedViews: views } });
  }
  await notify(proof.post.learnerId, { kind: "proof.views", href: "/coaching", text: approve ? `📊 Capture validée : ${views.toLocaleString("fr-FR")} vues.` : `Capture refusée : ${comment || "illisible ou non conforme."}` });
}

export async function reviewRankProof(reviewer: { id: string; role: string }, proofId: string, approve: boolean, comment = "", verified = false) {
  const proof = await prisma.rankProof.findUnique({ where: { id: proofId } });
  if (!proof || proof.status !== "PENDING") throw new CoachingError("Cette preuve a déjà été traitée.");
  if (approve && !verified) throw new CoachingError("Vérifie que les vidéos, la capture et les chiffres concordent avant de valider.");
  if (!approve && !comment.trim()) throw new CoachingError("Explique à l'élève pourquoi tu refuses.");
  await assertCoachOf(reviewer, proof.learnerId);
  await prisma.rankProof.update({
    where: { id: proofId },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewComment: comment || null, reviewedAt: new Date(), reviewedById: reviewer.id },
  });
  if (!approve) {
    await notify(proof.learnerId, { kind: "proof.refused", href: "/coaching", text: `Preuve refusée : ${comment || "capture illisible ou non conforme."}` });
    return;
  }
  const newRank: AnyRank | null = proof.kind === "FOLLOWERS_10K" ? "A" : rankFromMonthlyAmount(proof.amountEur ?? 0);
  const learner = await prisma.user.findUniqueOrThrow({ where: { id: proof.learnerId } });
  const best = maxRank(learner.manualRank as AnyRank | null, newRank);
  if (best && best !== learner.manualRank && ["A", "S", "SS", "SSS"].includes(best)) {
    await prisma.user.update({ where: { id: learner.id }, data: { manualRank: best as ManualRank } });
    await prisma.auditLog.create({ data: { actorUserId: reviewer.id, action: "RANK_GRANTED", entityType: "user", entityId: learner.id, metadata: { rank: best } } });
    await notify(learner.id, { kind: "rank.up", href: "/coaching", text: `🏅 Nouveau rang : ${best} !` });
  }
  if (best === "SSS" && learner.coachingStatus === "ACTIVE" && learner.role === "LEARNER") await completeCoaching(learner.id);
}

export async function listPendingProofs(coach: { id: string; role: string }) {
  const where = coach.role === "ADMIN" ? {} : { coachId: coach.id };
  // L'admin valide aussi les preuves de l'équipe (coachs et les siennes) ; un coach, celles de ses élèves.
  const learnerIds = (await prisma.user.findMany({ where: coach.role === "ADMIN" ? {} : { ...where, role: "LEARNER" }, select: { id: true } })).map((u) => u.id);
  const [views, ranks] = [
    await prisma.viewProof.findMany({
      where: { status: "PENDING", post: { learnerId: { in: learnerIds } } },
      include: { post: { include: { learner: { select: { displayName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    await prisma.rankProof.findMany({
      where: { status: "PENDING", learnerId: { in: learnerIds } },
      include: { learner: { select: { displayName: true, tiktokUsername: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ];
  return {
    views: views.map((v) => ({
      id: v.id,
      learner: v.post.learner.displayName,
      url: v.post.url,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      imageUrl: fileUrl(v.imageKey),
      createdAt: v.createdAt.toISOString(),
    })),
    ranks: ranks.map((r) => ({
      id: r.id,
      learner: r.learner.displayName,
      kind: r.kind,
      month: r.month,
      amountEur: r.amountEur,
      followers: r.followers,
      videoUrls: (r.videoUrls as string[]) ?? [],
      profileUrl: r.learner.tiktokUsername ? `https://www.tiktok.com/@${r.learner.tiktokUsername}` : null,
      imageUrl: fileUrl(r.imageKey),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// ---------- Points et classement ----------

export async function qualityPoints(learnerId: string) {
  const posts = await prisma.post.findMany({ where: { learnerId, validatedViews: { not: null } }, select: { validatedViews: true } });
  return posts.reduce((sum, p) => sum + viewPoints(p.validatedViews ?? 0), 0);
}

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
  const [streak, quality, posts, proofs, reactivation] = [
    await getStreak(learnerId, now),
    await qualityPoints(learnerId),
    await prisma.post.findMany({ where: { learnerId }, orderBy: { postedAt: "desc" }, take: 30, include: { viewProofs: { where: { status: "PENDING" } } } }),
    await prisma.rankProof.findMany({ where: { learnerId }, orderBy: { createdAt: "desc" } }),
    await prisma.reactivationRequest.findFirst({ where: { learnerId }, orderBy: { createdAt: "desc" } }),
  ];
  const window = monthlyWindow(localDate(now, tz));
  return {
    status: l.coachingStatus,
    coachName: l.coach?.displayName ?? null,
    tiktokUsername: l.tiktokUsername,
    timezone: l.timezone,
    rank: (l.manualRank ?? "B") as AnyRank,
    streak,
    activity: await getActivity(learnerId, now),
    points: { streak: streak.points, quality, total: streak.points + quality },
    posts: posts.map((p) => ({
      id: p.id,
      url: p.url,
      localDate: p.localDate,
      validatedViews: p.validatedViews,
      points: viewPoints(p.validatedViews ?? 0),
      pendingProof: p.viewProofs.length > 0,
    })),
    proofs: proofs.map((p) => ({ id: p.id, kind: p.kind, month: p.month, amountEur: p.amountEur, followers: p.followers, status: p.status, reviewComment: p.reviewComment, videoUrls: (p.videoUrls as string[]) ?? [] })),
    monthlyWindow: window,
    monthlyAlreadySent: window.month ? proofs.some((p) => p.kind === "MONTHLY" && p.month === window.month && p.status !== "REJECTED") : false,
    reactivation: reactivation ? { status: reactivation.status, createdAt: reactivation.createdAt.toISOString() } : null,
  };
}
export type CoachingDashboard = Awaited<ReturnType<typeof getCoachingDashboard>>;
