import "server-only";
import { prisma } from "@/server/db";
import { fileUrl } from "@/server/decisions/service";
import { localDate, isValidTimezone } from "@/server/coaching/rules";
import { USER_IMAGE_KEY } from "@/server/storage/images";
import { notify, notifyAdmins } from "@/server/notifications/service";
import { getEnv } from "@/server/env";
import type { ReactionKind } from "@/generated/prisma/enums";

// Posts de résultats : titre, capture, texte, lien. Séparés des revenus du mois (non comptés).
// Validation : élève → son coach ; coach → l'admin ; admin → validé d'office.

export class ResultPostError extends Error {}

export const MAX_POSTS_PER_DAY = 2;
export const REACTIONS: Record<ReactionKind, string> = { FIRE: "🔥", ROCKET: "🚀", ANGRY: "😡", CRY: "😢" };

const tzOf = (u: { timezone: string | null }) => (u.timezone && isValidTimezone(u.timezone) ? u.timezone : getEnv().APP_TIMEZONE);
const canPost = (u: { role: string; coachingStatus: string }) => u.role !== "LEARNER" || u.coachingStatus === "ACTIVE" || u.coachingStatus === "COMPLETED";

export async function createResultPost(userId: string, input: { title: string; body: string; imageKey: string; link?: string | null }, now = new Date()) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!canPost(u)) throw new ResultPostError("Les posts de résultats s'ouvrent après la formation, avec le coaching.");
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
  // 2 posts par jour (jour local de la personne).
  const tz = tzOf(u);
  const today = localDate(now, tz);
  const recent = await prisma.resultPost.findMany({ where: { authorId: userId, createdAt: { gte: new Date(now.getTime() - 26 * 3_600_000) } }, select: { createdAt: true } });
  if (recent.filter((p) => localDate(p.createdAt, tz) === today).length >= MAX_POSTS_PER_DAY) {
    throw new ResultPostError(`${MAX_POSTS_PER_DAY} posts par jour au maximum. Reviens demain !`);
  }
  const auto = u.role === "ADMIN";
  const post = await prisma.resultPost.create({
    data: { authorId: userId, title, body, imageKey: input.imageKey, link, createdAt: now, status: auto ? "APPROVED" : "PENDING", reviewedAt: auto ? now : null, reviewedById: auto ? userId : null },
  });
  if (!auto) {
    const text = `Nouveau post de résultat à valider : « ${title} » (${u.displayName})`;
    if (u.role === "COACH") await notifyAdmins({ kind: "coach.resultPost", href: "/coach/proofs", text });
    else if (u.coachId) await notify(u.coachId, { kind: "coach.resultPost", href: "/coach/proofs", text });
    else await notifyAdmins({ kind: "coach.resultPost", href: "/coach/proofs", text });
  }
  return post;
}

// Qui valide : le coach de l'élève (ou un admin) ; pour un coach, seulement l'admin.
async function assertReviewer(reviewer: { id: string; role: string }, authorId: string) {
  if (reviewer.role === "ADMIN") return;
  const a = await prisma.user.findUnique({ where: { id: authorId }, select: { coachId: true, role: true } });
  if (!a || a.role !== "LEARNER" || a.coachId !== reviewer.id) throw new ResultPostError("Post introuvable.");
}

export async function reviewResultPost(reviewer: { id: string; role: string }, postId: string, approve: boolean, comment = "", now = new Date()) {
  const post = await prisma.resultPost.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PENDING") throw new ResultPostError("Ce post a déjà été traité.");
  await assertReviewer(reviewer, post.authorId);
  if (!approve && !comment.trim()) throw new ResultPostError("Explique pourquoi tu refuses ce post.");
  await prisma.resultPost.update({
    where: { id: postId },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewComment: comment.trim() || null, reviewedAt: now, reviewedById: reviewer.id },
  });
  await notify(post.authorId, {
    kind: "resultPost.reviewed",
    href: "/profil",
    mood: approve ? "content" : "triste",
    text: approve ? `Ton post « ${post.title} » est publié !` : `Ton post « ${post.title} » n'a pas été validé : ${comment.trim()}`,
  });
}

export async function listPendingResultPosts(reviewer: { id: string; role: string }) {
  const where =
    reviewer.role === "ADMIN"
      ? { status: "PENDING" as const }
      : { status: "PENDING" as const, author: { coachId: reviewer.id, role: "LEARNER" as const } };
  const rows = await prisma.resultPost.findMany({ where, orderBy: { createdAt: "asc" }, include: { author: { select: { displayName: true, role: true } } } });
  return rows.map((p) => ({ id: p.id, author: p.author.displayName, authorRole: p.author.role, title: p.title, body: p.body, link: p.link, imageUrl: fileUrl(p.imageKey), createdAt: p.createdAt.toISOString() }));
}

// Posts d'un membre : publiés pour tout le monde ; l'auteur voit aussi ses posts en attente ou refusés.
export async function listResultPosts(authorId: string, viewerId: string) {
  const own = authorId === viewerId;
  const rows = await prisma.resultPost.findMany({
    where: { authorId, ...(own ? {} : { status: "APPROVED" as const }) },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { reactions: { select: { kind: true, userId: true } } },
  });
  return rows.map((p) => {
    const counts = { FIRE: 0, ROCKET: 0, ANGRY: 0, CRY: 0 } as Record<ReactionKind, number>;
    for (const r of p.reactions) counts[r.kind]++;
    return {
      id: p.id,
      title: p.title,
      body: p.body,
      link: p.link,
      imageUrl: fileUrl(p.imageKey),
      status: p.status,
      reviewComment: p.reviewComment,
      createdAt: p.createdAt.toISOString(),
      counts,
      mine: p.reactions.find((r) => r.userId === viewerId)?.kind ?? null,
    };
  });
}
export type ResultPostView = Awaited<ReturnType<typeof listResultPosts>>[number];

// Une réaction par membre et par post : choisir, changer ou retirer (kind = null).
export async function reactToPost(userId: string, postId: string, kind: ReactionKind | null) {
  const post = await prisma.resultPost.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post || post.status !== "APPROVED") throw new ResultPostError("Post introuvable.");
  if (!kind) {
    await prisma.postReaction.deleteMany({ where: { postId, userId } });
    return;
  }
  await prisma.postReaction.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, kind }, update: { kind } });
}

export async function isPublicResultImage(key: string) {
  return Boolean(await prisma.resultPost.findFirst({ where: { imageKey: key, status: "APPROVED" }, select: { id: true } }));
}
