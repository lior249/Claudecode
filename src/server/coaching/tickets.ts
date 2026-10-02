import "server-only";
import { prisma } from "@/server/db";
import { notify } from "@/server/notifications/service";
import { markReminder } from "@/server/notifications/service";
import { fileUrl } from "@/server/decisions/service";
import { USER_IMAGE_KEY } from "@/server/storage/images";
import type { TicketRating } from "@/generated/prisma/enums";
import {
  clampStars,
  COACH_REMINDERS_LEFT_MS,
  FAST_ANSWER_MS,
  FAST_ANSWERS_PER_STAR,
  FOLLOW_UP_HOURS,
  FOLLOW_UP_TEMPLATES,
  isoWeek,
  LATE_ANSWERS_PER_STAR,
  MAX_OPEN_LEARNER_TICKETS,
  RESPONSE_DEADLINE_MS,
} from "./rules";
import { CoachingError } from "./lifecycle";

type Viewer = { id: string; role: string };

const MAX_BODY = 4000;
const MAX_IMAGES = 4;

function cleanImages(ownerId: string, keys: string[]) {
  const ok = keys.filter((k) => USER_IMAGE_KEY.exec(k)?.[1] === ownerId);
  if (ok.length !== keys.length) throw new CoachingError("Image invalide.");
  if (ok.length > MAX_IMAGES) throw new CoachingError(`${MAX_IMAGES} images maximum par message.`);
  return ok;
}

async function activeLearner(learnerId: string) {
  const l = await prisma.user.findUnique({ where: { id: learnerId } });
  if (!l || l.coachingStatus !== "ACTIVE") throw new CoachingError("Ton espace coaching n'est pas actif.");
  if (l.role !== "LEARNER") throw new CoachingError("Les coachs et les admins n'ont pas de tickets coaching.");
  if (!l.coachId) throw new CoachingError("Aucun coach ne t'est encore attribué. L'équipe s'en occupe.");
  return l as typeof l & { coachId: string };
}

// Le ticket doit appartenir à l'élève ou au coach (sinon : introuvable, jamais « interdit »).
async function loadTicket(viewer: Viewer, ticketId: string) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!t) throw new CoachingError("Ticket introuvable.");
  if (viewer.role === "ADMIN" || t.learnerId === viewer.id || t.coachId === viewer.id) return t;
  throw new CoachingError("Ticket introuvable.");
}

// ---------- Élève ----------

export async function openLearnerTicket(learnerId: string, input: { subject: string; body: string; imageKeys: string[] }, now = new Date()) {
  const l = await activeLearner(learnerId);
  const subject = input.subject.trim().slice(0, 120);
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!subject || !body) throw new CoachingError("Donne un titre et décris ta demande.");
  const images = cleanImages(learnerId, input.imageKeys);
  const open = await prisma.ticket.count({ where: { learnerId, origin: "LEARNER", status: "OPEN" } });
  if (open >= MAX_OPEN_LEARNER_TICKETS) throw new CoachingError(`Tu as déjà ${MAX_OPEN_LEARNER_TICKETS} demandes en cours. Attends qu'une soit clôturée.`);

  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({ data: { learnerId, coachId: l.coachId, origin: "LEARNER", subject, createdAt: now } });
    await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: learnerId, body, imageKeys: images, createdAt: now } });
    await tx.responseWait.create({ data: { ticketId: t.id, coachId: l.coachId, askedAt: now, dueAt: new Date(now.getTime() + RESPONSE_DEADLINE_MS) } });
    return t;
  });
  await notify(l.coachId, { kind: "coach.newTicket", href: `/coach/tickets/${ticket.id}`, urgent: true, text: `📩 Nouvelle demande de ${l.displayName} : « ${subject} ». Tu as 12 h pour répondre.` });
  return ticket;
}

export async function postMessage(viewer: Viewer, ticketId: string, input: { body: string; imageKeys: string[]; followUpHours?: number | null }, now = new Date()) {
  const t = await loadTicket(viewer, ticketId);
  if (t.status !== "OPEN") throw new CoachingError("Ce ticket est clôturé.");
  const body = input.body.trim().slice(0, MAX_BODY);
  const images = cleanImages(viewer.id, input.imageKeys);
  if (!body && !images.length) throw new CoachingError("Écris un message.");
  const fromCoach = viewer.id === t.coachId;
  const fromLearner = viewer.id === t.learnerId;
  if (!fromCoach && !fromLearner) throw new CoachingError("Seuls l'élève et son coach écrivent dans un ticket.");
  const followUpHours = fromCoach && input.followUpHours && (FOLLOW_UP_HOURS as readonly number[]).includes(input.followUpHours) ? input.followUpHours : null;

  await prisma.ticketMessage.create({ data: { ticketId, authorId: viewer.id, body, imageKeys: images, followUpHours, createdAt: now } });
  if (fromCoach) {
    await answerWait(t.id, t.coachId, now);
    await notify(t.learnerId, { kind: "ticket.reply", href: `/coaching/tickets/${t.id}`, text: `💬 Ton coach t'a répondu : « ${t.subject} ».` });
  } else if (t.origin === "LEARNER") {
    await openWait(t.id, t.coachId, now);
    await notify(t.coachId, { kind: "coach.ticketMessage", href: `/coach/tickets/${t.id}`, urgent: true, text: `💬 Nouveau message dans « ${t.subject} ».` });
  } else {
    await notify(t.coachId, { kind: "coach.followUpReply", href: `/coach/tickets/${t.id}`, urgent: true, text: `💬 Réponse à ton suivi « ${t.subject} ».` });
  }
}

// « Conseil reçu, je l'applique » : message automatique et date de retour fixée par le coach.
export async function acknowledgeAdvice(learnerId: string, messageId: string, now = new Date()) {
  const m = await prisma.ticketMessage.findUnique({ where: { id: messageId }, include: { ticket: true } });
  if (!m || m.ticket.learnerId !== learnerId || m.authorId !== m.ticket.coachId) throw new CoachingError("Message introuvable.");
  if (m.acknowledgedAt) throw new CoachingError("Déjà confirmé.");
  if (m.ticket.status !== "OPEN") throw new CoachingError("Ce ticket est clôturé.");
  const hours = m.followUpHours ?? 24;
  const due = new Date(now.getTime() + hours * 3_600_000);
  await prisma.ticketMessage.update({ where: { id: m.id }, data: { acknowledgedAt: now, outcomeDueAt: due } });
  await prisma.ticketMessage.create({
    data: {
      ticketId: m.ticketId,
      authorId: learnerId,
      kind: "ACK",
      body: `Conseil reçu ✅ Je vais appliquer ce que tu m'as dit et je te reviens d'ici ${hours < 120 ? `${hours} h` : "5 jours"}.`,
      createdAt: now,
    },
  });
}

// Retour de l'élève après avoir appliqué le conseil : 👍 ou 👎 (explication obligatoire si 👎).
export async function reportOutcome(learnerId: string, messageId: string, worked: boolean, comment: string, now = new Date()) {
  const m = await prisma.ticketMessage.findUnique({ where: { id: messageId }, include: { ticket: true } });
  if (!m || m.ticket.learnerId !== learnerId || !m.acknowledgedAt) throw new CoachingError("Message introuvable.");
  if (m.outcome) throw new CoachingError("Tu as déjà donné ton retour.");
  if (!worked && comment.trim().length < 5) throw new CoachingError("Explique ce qui n'a pas marché.");
  await prisma.ticketMessage.update({ where: { id: m.id }, data: { outcome: worked ? "WORKED" : "DIDNT_WORK" } });
  await prisma.ticketMessage.create({
    data: {
      ticketId: m.ticketId,
      authorId: learnerId,
      kind: "OUTCOME",
      body: worked ? `👍 Ça a marché ! ${comment.trim()}`.trim() : `👎 Ça n'a pas marché : ${comment.trim()}`,
      createdAt: now,
    },
  });
  // Un 👎 relance le coach (nouveau délai de 12 h).
  if (!worked && m.ticket.origin === "LEARNER" && m.ticket.status === "OPEN") await openWait(m.ticketId, m.ticket.coachId, now);
  await notify(m.ticket.coachId, { kind: "coach.outcome", href: `/coach/tickets/${m.ticket.id}`, text: `${worked ? "👍" : "👎"} Retour sur ton conseil dans « ${m.ticket.subject} ».` });
}

// Seul le coach clôture. L'élève note ensuite la réponse (😞 😐 🙂).
export async function closeTicket(viewer: Viewer, ticketId: string, now = new Date()) {
  const t = await loadTicket(viewer, ticketId);
  if (viewer.id !== t.coachId && viewer.role !== "ADMIN") throw new CoachingError("Seul le coach peut clôturer un ticket.");
  if (t.status === "CLOSED") return;
  await prisma.ticket.update({ where: { id: t.id }, data: { status: "CLOSED", closedAt: now } });
  await answerWait(t.id, t.coachId, now); // clôturer vaut réponse
  if (t.origin === "LEARNER") await notify(t.learnerId, { kind: "ticket.closed", href: `/coaching/tickets/${t.id}`, text: `✅ Ta demande « ${t.subject} » est clôturée. Dis-nous ce que tu as pensé de la réponse.` });
}

export async function rateTicket(learnerId: string, ticketId: string, rating: TicketRating, comment: string, now = new Date()) {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!t || t.learnerId !== learnerId) throw new CoachingError("Ticket introuvable.");
  if (t.status !== "CLOSED" || t.origin !== "LEARNER") throw new CoachingError("Tu pourras noter une fois la demande clôturée.");
  if (t.rating) throw new CoachingError("Tu as déjà noté cette réponse.");
  if (rating !== "GOOD" && comment.trim().length < 5) throw new CoachingError("Explique ta note en quelques mots.");
  await prisma.ticket.update({ where: { id: t.id }, data: { rating, ratingComment: comment.trim().slice(0, 2000) || null, ratedAt: now } });
}

// ---------- Coach : questions de suivi prédéfinies, envoyées en masse ----------

export async function sendFollowUps(coachId: string, templateKey: string, learnerIds: string[], now = new Date()) {
  const template = FOLLOW_UP_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) throw new CoachingError("Question inconnue.");
  const learners = await prisma.user.findMany({ where: { id: { in: learnerIds }, coachId, coachingStatus: "ACTIVE" }, select: { id: true } });
  let sent = 0;
  const skipped: string[] = [];
  for (const { id } of learners) {
    try {
      await prisma.$transaction(async (tx) => {
        const t = await tx.ticket.create({ data: { learnerId: id, coachId, origin: "COACH", subject: template.subject, templateKey: template.key, createdAt: now } });
        await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: coachId, body: template.body, createdAt: now } });
      });
      sent++;
      await notify(id, { kind: "ticket.followUp", href: "/coaching", text: `📝 Ton coach te pose une question : « ${template.subject} ». Réponds sur Creato.` });
    } catch (e) {
      // Un seul ticket de suivi ouvert par élève (index unique en base).
      if ((e as { code?: string }).code === "P2002") skipped.push(id);
      else throw e;
    }
  }
  return { sent, skipped: skipped.length + (learnerIds.length - learners.length) };
}

// ---------- Délai de 12 h et étoiles ----------

async function openWait(ticketId: string, coachId: string, now: Date) {
  try {
    await prisma.responseWait.create({ data: { ticketId, coachId, askedAt: now, dueAt: new Date(now.getTime() + RESPONSE_DEADLINE_MS) } });
  } catch (e) {
    // Une attente est déjà en cours pour ce ticket : le délai court depuis le premier message sans réponse.
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
}

async function answerWait(ticketId: string, coachId: string, now: Date) {
  const wait = await prisma.responseWait.findFirst({ where: { ticketId, answeredAt: null } });
  if (!wait) return;
  const fast = now.getTime() - wait.askedAt.getTime() < FAST_ANSWER_MS;
  const lateNow = !wait.late && now > wait.dueAt;
  await prisma.responseWait.update({
    where: { id: wait.id },
    data: { answeredAt: now, fast, ...(lateNow ? { late: true, lateWeek: isoWeek(wait.dueAt) } : {}) },
  });
  if (lateNow) await applyLate(coachId, isoWeek(wait.dueAt));
  if (fast) {
    const coach = await prisma.user.update({ where: { id: coachId }, data: { coachFastAnswers: { increment: 1 } } });
    if (coach.coachFastAnswers % FAST_ANSWERS_PER_STAR === 0) await changeStars(coachId, +1, `${FAST_ANSWERS_PER_STAR} réponses en moins d'une heure`);
  }
}

async function applyLate(coachId: string, week: string) {
  const lateThisWeek = await prisma.responseWait.count({ where: { coachId, late: true, lateWeek: week } });
  if (lateThisWeek > 0 && lateThisWeek % LATE_ANSWERS_PER_STAR === 0) {
    await changeStars(coachId, -1, `${LATE_ANSWERS_PER_STAR} réponses en retard dans la semaine ${week}`);
  }
}

async function changeStars(coachId: string, delta: number, reason: string) {
  const coach = await prisma.user.findUniqueOrThrow({ where: { id: coachId } });
  const stars = clampStars(coach.coachStars + delta);
  if (stars === coach.coachStars) return;
  await prisma.user.update({ where: { id: coachId }, data: { coachStars: stars } });
  await prisma.coachStarEvent.create({ data: { coachId, delta: stars - coach.coachStars, stars, reason } });
  await notify(coachId, {
    kind: "coach.stars",
    href: "/coach",
    text: stars > coach.coachStars ? `⭐ +1 étoile (${stars}/6) : ${reason}. Bravo !` : `⚠️ −1 étoile (${stars}/6) : ${reason}. Réponds dans les 12 h pour remonter.`,
  });
}

// Tâche périodique : rappels au coach à 4 h et 2 h de la fin, retards comptés dès que le délai est dépassé.
export async function processResponseWaits(now = new Date()) {
  const waits = await prisma.responseWait.findMany({ where: { answeredAt: null }, include: { ticket: { include: { learner: { select: { displayName: true } } } } } });
  let reminded = 0;
  for (const w of waits) {
    const left = w.dueAt.getTime() - now.getTime();
    if (left <= 0) {
      if (!w.late) {
        const marked = await prisma.responseWait.updateMany({ where: { id: w.id, late: false }, data: { late: true, lateWeek: isoWeek(w.dueAt) } });
        if (marked.count) await applyLate(w.coachId, isoWeek(w.dueAt));
      }
      continue;
    }
    for (const threshold of COACH_REMINDERS_LEFT_MS) {
      if (left <= threshold && (await markReminder(w.coachId, `wait${threshold / 3_600_000}h:${w.id}`))) {
        await notify(w.coachId, { kind: "coach.deadline", href: `/coach/tickets/${w.ticketId}`, urgent: true, text: `⏰ Plus que ${Math.ceil(left / 3_600_000)} h pour répondre à ${w.ticket.learner.displayName} (« ${w.ticket.subject} »).` });
        reminded++;
        break;
      }
    }
  }
  return reminded;
}

// Rappel à l'élève : dire si le conseil a marché.
export async function processOutcomeReminders(now = new Date()) {
  const due = await prisma.ticketMessage.findMany({
    where: { outcomeDueAt: { lte: now }, outcome: null, ticket: { status: "OPEN" } },
    include: { ticket: true },
  });
  for (const m of due) {
    if (await markReminder(m.ticket.learnerId, `outcome:${m.id}`)) {
      await notify(m.ticket.learnerId, { kind: "ticket.outcomeAsk", href: `/coaching/tickets/${m.ticket.id}`, text: `🔔 Alors, le conseil de ton coach a marché ? Donne ton retour dans « ${m.ticket.subject} ».` });
    }
  }
}

// ---------- Lecture ----------

export async function listTicketsForLearner(learnerId: string) {
  return prisma.ticket.findMany({
    where: { learnerId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, waits: { where: { answeredAt: null } } },
  });
}

export async function listTicketsForCoach(coachId: string) {
  return prisma.ticket.findMany({
    where: { coachId, status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: { learner: { select: { displayName: true } }, waits: { where: { answeredAt: null } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

export async function getTicketView(viewer: Viewer, ticketId: string) {
  const t = await loadTicket(viewer, ticketId);
  const full = await prisma.ticket.findUniqueOrThrow({
    where: { id: t.id },
    include: {
      learner: { select: { id: true, displayName: true } },
      coach: { select: { id: true, displayName: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, displayName: true } } } },
      waits: { where: { answeredAt: null } },
    },
  });
  return {
    id: full.id,
    subject: full.subject,
    origin: full.origin,
    status: full.status,
    createdAt: full.createdAt.toISOString(),
    closedAt: full.closedAt?.toISOString() ?? null,
    rating: full.rating,
    ratingComment: full.ratingComment,
    learner: full.learner,
    coach: full.coach,
    dueAt: full.waits[0]?.dueAt.toISOString() ?? null,
    viewerIs: viewer.id === full.learnerId ? ("LEARNER" as const) : viewer.id === full.coachId ? ("COACH" as const) : ("ADMIN" as const),
    messages: full.messages.map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      images: (m.imageKeys as string[]).map(fileUrl),
      fromCoach: m.authorId === full.coachId,
      author: m.author.displayName,
      createdAt: m.createdAt.toISOString(),
      followUpHours: m.followUpHours,
      acknowledgedAt: m.acknowledgedAt?.toISOString() ?? null,
      outcomeDueAt: m.outcomeDueAt?.toISOString() ?? null,
      outcome: m.outcome,
    })),
  };
}
export type TicketView = Awaited<ReturnType<typeof getTicketView>>;

// Boîte de réception du coach : tickets ouverts, triés par urgence, avec le temps restant.
export async function coachInbox(coachId: string, now = new Date()) {
  const tickets = await listTicketsForCoach(coachId);
  return tickets
    .map((t) => ({
      id: t.id,
      learner: t.learner.displayName,
      subject: t.subject,
      origin: t.origin,
      msLeft: t.waits[0] ? t.waits[0].dueAt.getTime() - now.getTime() : null,
    }))
    .sort((a, b) => (a.msLeft ?? Infinity) - (b.msLeft ?? Infinity));
}
