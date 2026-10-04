import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "@/server/db";
import { fileUrl } from "@/server/decisions/service";
import { localDate, isValidTimezone, monthlyWindow, maxRank, type AnyRank } from "@/server/coaching/rules";
import { completeCoaching } from "@/server/coaching/lifecycle";
import { MIME_BY_EXT, USER_IMAGE_KEY } from "@/server/storage/images";
import { filePath } from "@/server/storage/storage";
import { notify, notifyAdmins } from "@/server/notifications/service";
import { getScreenshotReader } from "@/server/ai";
import { enqueue } from "@/server/jobs/queue";
import { getEnv } from "@/server/env";
import type { ManualRank, ReactionKind, ResultSpecial } from "@/generated/prisma/enums";
import { dailyCode, MAX_POSTS_PER_DAY, METRIC_LABELS, normalizeIdentifier, parseTiers, pointsGained, resultPoints, specialRank } from "./rules";

// Résultats : le membre choisit un type (défini par l'admin), envoie sa capture avec le code du jour,
// Claude la lit dans le worker ; conforme → publié avec les points, sinon → vérifié par le coach ou l'admin.

export class ResultPostError extends Error {}

export { MAX_POSTS_PER_DAY };
export const REACTIONS: Record<ReactionKind, string> = { FIRE: "🔥", ROCKET: "🚀", ANGRY: "😡", CRY: "😢" };

const tzOf = (u: { timezone: string | null }) => (u.timezone && isValidTimezone(u.timezone) ? u.timezone : getEnv().APP_TIMEZONE);
const canPost = (u: { role: string; coachingStatus: string }) => u.role !== "LEARNER" || u.coachingStatus === "ACTIVE" || u.coachingStatus === "COMPLETED";

// Image d'exemple : envoyée par l'admin (stockage) ou fournie avec l'application (public/exemples).
export const exampleUrl = (key: string | null) => (!key ? null : key.startsWith("exemples/") ? `/${key}` : fileUrl(key));

// ---------- Types de résultats (lecture) ----------

export async function listResultTypes(opts: { activeOnly?: boolean } = {}) {
  const rows = await prisma.resultType.findMany({
    where: opts.activeOnly ? { isActive: true } : {},
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { posts: true } } },
  });
  return rows.map(typeView);
}

function typeView(t: Awaited<ReturnType<typeof prisma.resultType.findUniqueOrThrow>> & { _count?: { posts: number } }) {
  return {
    id: t.id,
    name: t.name,
    instructions: t.instructions,
    exampleKey: t.exampleKey,
    exampleUrl: exampleUrl(t.exampleKey),
    aiMustHave: t.aiMustHave,
    aiMustNotHave: t.aiMustNotHave,
    aiIdentifier: t.aiIdentifier,
    points: t.points,
    metric: t.metric,
    tiers: parseTiers(t.tiers),
    special: t.special,
    isActive: t.isActive,
    posts: t._count?.posts ?? 0,
  };
}
export type ResultTypeView = ReturnType<typeof typeView>;

export async function getResultType(id: string) {
  const t = await prisma.resultType.findUnique({ where: { id } });
  return t ? typeView(t) : null;
}

// ---------- Publication ----------

/** Code du jour du membre (à écrire sur sa capture). */
export async function todayCode(userId: string, now = new Date()) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
  return dailyCode(getEnv().SESSION_SECRET, userId, localDate(now, tzOf(u)));
}

/** Ce qui bloque l'envoi d'un type donné aujourd'hui (null = possible). */
export async function blockedReason(userId: string, typeId: string, now = new Date()): Promise<string | null> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!canPost(u)) return "Les résultats s'ouvrent après la formation, avec le coaching.";
  const type = await prisma.resultType.findUnique({ where: { id: typeId } });
  if (!type || !type.isActive) return "Ce type de résultat n'existe plus.";
  const tz = tzOf(u);
  const today = localDate(now, tz);
  const recent = await prisma.resultPost.findMany({ where: { authorId: userId, createdAt: { gte: new Date(now.getTime() - 26 * 3_600_000) } }, select: { createdAt: true } });
  if (recent.filter((p) => localDate(p.createdAt, tz) === today).length >= MAX_POSTS_PER_DAY) return `${MAX_POSTS_PER_DAY} résultats par jour au maximum. Reviens demain !`;
  if (type.special === "MONTHLY_REVENUE") {
    const window = monthlyWindow(today);
    if (!window.open || !window.month) return "Les revenus du mois s'envoient uniquement le dernier jour du mois.";
    const sent = await prisma.resultPost.findFirst({ where: { authorId: userId, typeId, month: window.month, status: { not: "REJECTED" } } });
    if (sent) return "Tes revenus de ce mois sont déjà envoyés.";
  }
  return null;
}

export async function createResult(userId: string, input: { typeId: string; title: string; body: string; imageKey: string; link?: string | null }, now = new Date()) {
  const blocked = await blockedReason(userId, input.typeId, now);
  if (blocked) throw new ResultPostError(blocked);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const type = await prisma.resultType.findUniqueOrThrow({ where: { id: input.typeId } });
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3 || title.length > 90) throw new ResultPostError("Donne un titre de 3 à 90 caractères.");
  if (body.length > 1500) throw new ResultPostError("Ton texte est trop long (1 500 caractères maximum).");
  if (USER_IMAGE_KEY.exec(input.imageKey)?.[1] !== userId) throw new ResultPostError("Ajoute la capture de ton résultat.");
  let link: string | null = null;
  if (input.link?.trim()) {
    try {
      const url = new URL(input.link.trim());
      if (url.protocol !== "https:") throw new Error();
      link = url.toString();
    } catch {
      throw new ResultPostError("Le lien doit commencer par https://");
    }
  }
  // Une même capture ne sert qu'une fois.
  const imageSha256 = createHash("sha256").update(await readFile(filePath(input.imageKey))).digest("hex");
  if (await prisma.resultPost.findFirst({ where: { authorId: userId, imageSha256, status: { not: "REJECTED" } } })) {
    throw new ResultPostError("Tu as déjà envoyé cette capture.");
  }
  const tz = tzOf(u);
  const month = type.special === "MONTHLY_REVENUE" ? monthlyWindow(localDate(now, tz)).month : null;
  // Plafond mensuel de lectures par l'IA : au-delà, la capture est vérifiée à la main.
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const readsThisMonth = await prisma.resultPost.count({ where: { aiModel: { not: null }, createdAt: { gte: monthStart } } });
  const overBudget = readsThisMonth >= getEnv().AI_MONTHLY_MAX_READS;
  const post = await prisma.resultPost.create({
    data: {
      authorId: userId,
      typeId: type.id,
      title,
      body,
      imageKey: input.imageKey,
      imageSha256,
      link,
      dailyCode: dailyCode(getEnv().SESSION_SECRET, userId, localDate(now, tz)),
      month,
      status: overBudget ? "PENDING" : "ANALYZING",
      aiReport: overBudget ? { error: "Plafond mensuel de lectures par l'IA atteint : vérification à la main." } : undefined,
      createdAt: now,
    },
  });
  if (overBudget) await notifyReviewers(userId, `Résultat à vérifier : « ${title} »`);
  else await enqueue("result.read", { postId: post.id }, now, 1);
  return post;
}

// ---------- Lecture par l'IA (worker) ----------

export async function processResultRead(postId: string) {
  const post = await prisma.resultPost.findUnique({ where: { id: postId }, include: { type: true } });
  if (!post || post.status !== "ANALYZING") return;
  const ext = post.imageKey.split(".").pop() ?? "jpg";
  const t = post.type;
  let verdict;
  try {
    verdict = await getScreenshotReader().read({
      typeName: t.name,
      instructions: t.instructions,
      mustHave: t.aiMustHave,
      mustNotHave: t.aiMustNotHave,
      identifier: t.aiIdentifier,
      metricRead: METRIC_LABELS[t.metric].read,
      dailyCode: post.dailyCode,
      title: post.title,
      image: { data: await readFile(filePath(post.imageKey)), mime: MIME_BY_EXT[ext] as "image/jpeg" },
    });
  } catch (e) {
    // Panne de l'IA : on ne bloque pas le membre, un humain vérifie.
    console.error(`[résultat ${postId}] lecture impossible`, e);
    await prisma.resultPost.update({ where: { id: postId }, data: { status: "PENDING", aiReport: { error: "L'IA n'a pas pu lire la capture." } } });
    await notifyReviewers(post.authorId, `Résultat à vérifier (IA indisponible) : « ${post.title} »`);
    return;
  }
  const { model, ...report } = verdict;
  const needsMetric = t.metric !== "NONE";
  const ok = report.conforms && report.codeFound && !report.forbiddenFound && (!needsMetric || report.metricValue !== null) && (!t.aiIdentifier || !!report.identifier);
  await prisma.resultPost.update({
    where: { id: postId },
    data: { aiReport: report, aiModel: model, metricValue: report.metricValue, identifier: normalizeIdentifier(report.identifier) },
  });
  if (ok) {
    await approve(postId, report.metricValue, null);
    return;
  }
  await prisma.resultPost.update({ where: { id: postId }, data: { status: "PENDING" } });
  await notify(post.authorId, {
    kind: "resultPost.checking",
    href: "/resultats/mes-resultats",
    text: `Ta capture « ${post.title} » n'a pas été validée automatiquement : ${problemText(report)} Un coach va la vérifier.`,
  });
  await notifyReviewers(post.authorId, `Résultat à vérifier : « ${post.title} »`);
}

function problemText(r: { problems: string[]; codeFound: boolean }) {
  const list = [...r.problems];
  if (!r.codeFound && !list.some((p) => /code/i.test(p))) list.push("le code du jour n'apparaît pas sur la capture.");
  return list.join(" ") || "elle ne correspond pas à l'exemple.";
}

// Publication : points calculés par le serveur (une seule fois par résultat identique), rangs spéciaux.
async function approve(postId: string, metricValue: number | null, reviewerId: string | null, now = new Date()) {
  const post = await prisma.resultPost.findUniqueOrThrow({ where: { id: postId }, include: { type: true } });
  const t = post.type;
  const full = resultPoints({ points: t.points, metric: t.metric, tiers: t.tiers }, metricValue);
  let previousBest = 0;
  if (post.identifier) {
    const same = await prisma.resultPost.findMany({ where: { authorId: post.authorId, typeId: t.id, identifier: post.identifier, status: "APPROVED", id: { not: postId } } });
    // Points déjà gagnés pour ce même résultat (somme des fois précédentes).
    previousBest = same.reduce((s, p) => s + p.points, 0);
  }
  if (t.special !== "NONE") {
    const same = await prisma.resultPost.findMany({ where: { authorId: post.authorId, typeId: t.id, status: "APPROVED", id: { not: postId }, ...(post.month ? { month: post.month } : {}) } });
    previousBest = Math.max(previousBest, same.reduce((s, p) => s + p.points, 0));
  }
  const points = pointsGained(full, previousBest);
  await prisma.resultPost.update({
    where: { id: postId },
    data: { status: "APPROVED", metricValue, points, reviewedAt: now, reviewedById: reviewerId },
  });
  await notify(post.authorId, {
    kind: "resultPost.reviewed",
    href: "/resultats/mes-resultats",
    mood: "content",
    text: `Ton résultat « ${post.title} » est publié${points ? ` : +${points} point${points > 1 ? "s" : ""}` : ""} !`,
  });
  await grantSpecialRank(post.authorId, t.special, metricValue, reviewerId);
}

async function grantSpecialRank(userId: string, special: ResultSpecial, metricValue: number | null, actorId: string | null) {
  const rank = specialRank(special, metricValue);
  if (!rank) return;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const best = maxRank(u.manualRank as AnyRank | null, rank);
  if (best && best !== u.manualRank) {
    await prisma.user.update({ where: { id: userId }, data: { manualRank: best as ManualRank } });
    await prisma.auditLog.create({ data: { actorUserId: actorId ?? userId, action: "RANK_GRANTED", entityType: "user", entityId: userId, metadata: { rank: best } } });
    await notify(userId, { kind: "rank.up", href: "/coaching", text: `Nouveau rang : ${best} !` });
  }
  if (best === "SSS" && u.coachingStatus === "ACTIVE" && u.role === "LEARNER") await completeCoaching(u.id);
}

// ---------- Vérification à la main ----------

// Qui vérifie : le coach de l'élève ; l'admin pour les coachs, les admins et les élèves sans coach.
async function notifyReviewers(authorId: string, text: string) {
  const a = await prisma.user.findUniqueOrThrow({ where: { id: authorId }, select: { coachId: true, role: true, displayName: true } });
  const message = `${text} (${a.displayName})`;
  if (a.role === "LEARNER" && a.coachId) await notify(a.coachId, { kind: "coach.resultPost", href: "/coach/proofs", text: message });
  else await notifyAdmins({ kind: "coach.resultPost", href: "/coach/proofs", text: message });
}

async function assertReviewer(reviewer: { id: string; role: string }, authorId: string) {
  if (reviewer.role === "ADMIN") return;
  const a = await prisma.user.findUnique({ where: { id: authorId }, select: { coachId: true, role: true } });
  if (!a || a.role !== "LEARNER" || a.coachId !== reviewer.id) throw new ResultPostError("Résultat introuvable.");
}

export async function reviewResult(reviewer: { id: string; role: string }, postId: string, input: { approve: boolean; metricValue?: number | null; comment?: string }, now = new Date()) {
  const post = await prisma.resultPost.findUnique({ where: { id: postId }, include: { type: true } });
  if (!post || post.status !== "PENDING") throw new ResultPostError("Ce résultat a déjà été traité.");
  await assertReviewer(reviewer, post.authorId);
  const comment = input.comment?.trim() ?? "";
  if (!input.approve) {
    if (!comment) throw new ResultPostError("Explique pourquoi tu refuses ce résultat.");
    await prisma.resultPost.update({ where: { id: postId }, data: { status: "REJECTED", reviewComment: comment, reviewedAt: now, reviewedById: reviewer.id } });
    await notify(post.authorId, { kind: "resultPost.reviewed", href: "/resultats/mes-resultats", mood: "triste", text: `Ton résultat « ${post.title} » n'a pas été validé : ${comment}` });
    return;
  }
  const metricValue = post.type.metric === "NONE" ? null : (input.metricValue ?? post.metricValue);
  if (post.type.metric !== "NONE" && (metricValue === null || !Number.isInteger(metricValue) || metricValue < 0)) {
    throw new ResultPostError(`Indique le chiffre lu sur la capture (${METRIC_LABELS[post.type.metric].unit}).`);
  }
  if (comment) await prisma.resultPost.update({ where: { id: postId }, data: { reviewComment: comment } });
  await approve(postId, metricValue, reviewer.id, now);
}

export async function listPendingResults(reviewer: { id: string; role: string }) {
  const where =
    reviewer.role === "ADMIN" ? { status: "PENDING" as const } : { status: "PENDING" as const, author: { coachId: reviewer.id, role: "LEARNER" as const } };
  const rows = await prisma.resultPost.findMany({ where, orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true, role: true } }, type: true } });
  return rows.map((p) => {
    const report = (p.aiReport ?? {}) as { problems?: string[]; summary?: string; error?: string; codeFound?: boolean };
    return {
      id: p.id,
      author: p.author.displayName,
      authorRole: p.author.role,
      typeName: p.type.name,
      metric: p.type.metric,
      metricLabel: METRIC_LABELS[p.type.metric].label,
      title: p.title,
      body: p.body,
      link: p.link,
      imageUrl: fileUrl(p.imageKey),
      dailyCode: p.dailyCode,
      metricValue: p.metricValue,
      aiProblems: report.error ? [report.error] : (report.problems ?? []),
      aiCodeFound: report.codeFound ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

// ---------- Affichage ----------

function countReactions(reactions: { kind: ReactionKind; userId: string }[], viewerId: string) {
  const counts = { FIRE: 0, ROCKET: 0, ANGRY: 0, CRY: 0 } as Record<ReactionKind, number>;
  for (const r of reactions) counts[r.kind]++;
  return { counts, mine: reactions.find((r) => r.userId === viewerId)?.kind ?? null };
}

// Résultats d'un membre : publiés pour tout le monde ; le membre voit aussi les siens en cours ou refusés.
export async function listResultPosts(authorId: string, viewerId: string) {
  const own = authorId === viewerId;
  const rows = await prisma.resultPost.findMany({
    where: { authorId, ...(own ? {} : { status: "APPROVED" as const }) },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { reactions: { select: { kind: true, userId: true } }, type: { select: { name: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    link: p.link,
    imageUrl: fileUrl(p.imageKey),
    status: p.status,
    reviewComment: p.reviewComment,
    createdAt: p.createdAt.toISOString(),
    typeName: p.type.name,
    points: p.points,
    ...countReactions(p.reactions, viewerId),
  }));
}
export type ResultPostView = Awaited<ReturnType<typeof listResultPosts>>[number];

export const GALLERY_PAGE = 48;

/** Galerie de tous les résultats publiés, du plus récent au plus ancien (filtre par type, page suivante par date). */
export async function listGallery(viewerId: string, opts: { typeId?: string | null; before?: Date | null } = {}) {
  const rows = await prisma.resultPost.findMany({
    where: { status: "APPROVED", ...(opts.typeId ? { typeId: opts.typeId } : {}), ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: GALLERY_PAGE + 1,
    include: {
      reactions: { select: { kind: true, userId: true } },
      type: { select: { name: true } },
      author: { select: { displayName: true, photoKey: true, avatarUrl: true } },
    },
  });
  const page = rows.slice(0, GALLERY_PAGE);
  return {
    items: page.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      link: p.link,
      imageUrl: fileUrl(p.imageKey),
      status: p.status,
      reviewComment: null,
      createdAt: p.createdAt.toISOString(),
      typeName: p.type.name,
      points: p.points,
      author: p.author.displayName,
      authorAvatar: p.author.photoKey ? fileUrl(p.author.photoKey) : p.author.avatarUrl,
      ...countReactions(p.reactions, viewerId),
    })),
    nextBefore: rows.length > GALLERY_PAGE ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

/** Points gagnés par les résultats publiés d'un membre. */
export async function resultPointsTotal(authorId: string) {
  const r = await prisma.resultPost.aggregate({ where: { authorId, status: "APPROVED" }, _sum: { points: true } });
  return r._sum.points ?? 0;
}

/** Revenus du mois publiés (type spécial), du plus récent au plus ancien. */
export async function monthlyRevenues(authorId: string) {
  const rows = await prisma.resultPost.findMany({
    where: { authorId, status: "APPROVED", type: { special: "MONTHLY_REVENUE" } },
    orderBy: { createdAt: "desc" },
  });
  // Un seul chiffre par mois : le dernier publié.
  const byMonth = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.month && !byMonth.has(r.month)) byMonth.set(r.month, r);
  const list = [...byMonth.values()];
  const best = list.reduce((m, r) => Math.max(m, r.metricValue ?? 0), 0);
  return list.map((r) => ({
    id: r.id,
    month: r.month!,
    amountEur: r.metricValue ?? 0,
    imageUrl: fileUrl(r.imageKey),
    description: r.body,
    isBest: best > 0 && (r.metricValue ?? 0) === best,
  }));
}

// Une réaction par membre et par résultat : choisir, changer ou retirer (kind = null).
export async function reactToPost(userId: string, postId: string, kind: ReactionKind | null) {
  const post = await prisma.resultPost.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post || post.status !== "APPROVED") throw new ResultPostError("Résultat introuvable.");
  if (!kind) {
    await prisma.postReaction.deleteMany({ where: { postId, userId } });
    return;
  }
  await prisma.postReaction.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, kind }, update: { kind } });
}

export async function isPublicResultImage(key: string) {
  return Boolean(await prisma.resultPost.findFirst({ where: { imageKey: key, status: "APPROVED" }, select: { id: true } }));
}
