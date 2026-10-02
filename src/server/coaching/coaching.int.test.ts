import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDb } from "../../../tests/db";
import { CoachingError, decideReactivation, pickCoachByStars, processAbsences, requestReactivation, startCoaching } from "./lifecycle";
import {
  acknowledgeAdvice,
  closeTicket,
  getTicketView,
  openLearnerTicket,
  postMessage,
  processResponseWaits,
  rateTicket,
  reportOutcome,
  sendFollowUps,
} from "./tickets";
import { addPost, getStreak, leaderboard, reviewRankProof, reviewViewProof, submitMonthlyProof, submitViewProof, updateCoachingProfile } from "./progress";
import { addCoach, coachReport, listCoachCandidates, removeCoach } from "./admin";

const H = 3_600_000;
const D = 24 * H;
const idFor = (d: Date) => (BigInt(Math.floor(d.getTime() / 1000)) << BigInt(32)) + BigInt(42);
const img = (ownerId: string, n = 1) => `uploads/${ownerId}/0000000${n}-0000-4000-8000-000000000000.png`;

async function coach(name: string, stars = 3, capacity = 20, order = 1) {
  return prisma.user.create({ data: { displayName: name, role: "COACH", coachOrder: order, coachStars: stars, coachCapacity: capacity } });
}
async function learner(name: string, coachId: string | null, start = new Date()) {
  return prisma.user.create({
    data: { displayName: name, role: "LEARNER", coachId, coachingStatus: coachId ? "ACTIVE" : "NONE", coachingStartedAt: start, tiktokUsername: name.toLowerCase(), timezone: "Europe/Paris" },
  });
}

describe("Places et attribution des coachs", () => {
  beforeEach(resetDb);

  it("le coach avec le plus d'étoiles et une place libre est choisi", async () => {
    expect(pickCoachByStars([
      { id: "a", coachStars: 3, coachOrder: 1, free: 5 },
      { id: "b", coachStars: 5, coachOrder: 2, free: 0 },
      { id: "c", coachStars: 4, coachOrder: 3, free: 1 },
    ])).toBe("c");
    const c1 = await coach("C1", 3, 20, 1);
    const c2 = await coach("C2", 5, 1, 2);
    const l1 = await learner("eleve1", null);
    const l2 = await learner("eleve2", null);
    expect(await startCoaching(l1.id)).toBe(c2.id);
    expect(await startCoaching(l2.id)).toBe(c1.id); // C2 est plein (1 place)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: l2.id } })).coachingStatus).toBe("ACTIVE");
    expect(await prisma.job.count({ where: { type: "discord.grantElite" } })).toBe(2);
  });
});

describe("Tickets", () => {
  beforeEach(resetDb);

  it("3 demandes ouvertes au maximum ; seuls l'élève et son coach y accèdent", async () => {
    const c = await coach("Coach");
    const l = await learner("eleve", c.id);
    const other = await learner("autre", c.id);
    for (let i = 0; i < 3; i++) await openLearnerTicket(l.id, { subject: `Q${i}`, body: "Aide", imageKeys: [] });
    await expect(openLearnerTicket(l.id, { subject: "Q4", body: "Aide", imageKeys: [] })).rejects.toThrow("3 demandes");
    const t = await prisma.ticket.findFirstOrThrow({ where: { learnerId: l.id } });
    await expect(getTicketView({ id: other.id, role: "LEARNER" }, t.id)).rejects.toThrow("introuvable");
    await expect(openLearnerTicket(l.id, { subject: "x", body: "y", imageKeys: [img(other.id)] })).rejects.toThrow(CoachingError);
  });

  it("réponse en moins d'1 h ×10 = +1 étoile (6 maximum)", async () => {
    const c = await coach("Coach", 5);
    const l = await learner("eleve", c.id);
    const t0 = new Date("2026-10-05T10:00:00Z");
    for (let i = 0; i < 20; i++) {
      const at = new Date(t0.getTime() + i * H);
      const t = await openLearnerTicket(l.id, { subject: `Q${i}`, body: "?", imageKeys: [] }, at);
      await postMessage({ id: c.id, role: "COACH" }, t.id, { body: "Réponse", imageKeys: [] }, new Date(at.getTime() + 10 * 60_000));
      await closeTicket({ id: c.id, role: "COACH" }, t.id, new Date(at.getTime() + 11 * 60_000));
    }
    const after = await prisma.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ coachFastAnswers: 20, coachStars: 6 });
  });

  it("5 réponses en retard dans la semaine = −1 étoile (1 minimum) ; rappels à 4 h et 2 h", async () => {
    const c = await coach("Coach", 2);
    const l = await learner("eleve", c.id);
    const t0 = new Date("2026-10-05T08:00:00Z"); // lundi
    const tickets = [];
    for (let i = 0; i < 3; i++) tickets.push(await openLearnerTicket(l.id, { subject: `Q${i}`, body: "?", imageKeys: [] }, t0));
    expect(await processResponseWaits(new Date(t0.getTime() + 8.5 * H))).toBe(3); // rappel « 4 h »
    expect(await processResponseWaits(new Date(t0.getTime() + 9 * H))).toBe(0); // pas de doublon
    expect(await processResponseWaits(new Date(t0.getTime() + 10.5 * H))).toBe(3); // rappel « 2 h »
    await processResponseWaits(new Date(t0.getTime() + 13 * H)); // 3 retards
    for (const t of tickets) await closeTicket({ id: c.id, role: "COACH" }, t.id, new Date(t0.getTime() + 14 * H));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).coachStars).toBe(2);
    for (let i = 0; i < 2; i++) {
      const t = await openLearnerTicket(l.id, { subject: `R${i}`, body: "?", imageKeys: [] }, new Date(t0.getTime() + D));
      await postMessage({ id: c.id, role: "COACH" }, t.id, { body: "Désolé", imageKeys: [] }, new Date(t0.getTime() + D + 13 * H));
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).coachStars).toBe(1);
    expect((await coachReport(new Date(t0.getTime() + D)))[0]).toMatchObject({ lateWeek: 5, coachStars: 1 });
  });

  it("conseil reçu → retour 👎 (explication obligatoire) → le coach doit répondre à nouveau", async () => {
    const c = await coach("Coach");
    const l = await learner("eleve", c.id);
    const t = await openLearnerTicket(l.id, { subject: "Mes vues", body: "Mes vues baissent", imageKeys: [] });
    await postMessage({ id: c.id, role: "COACH" }, t.id, { body: "Raccourcis ton hook", imageKeys: [], followUpHours: 72 });
    const advice = await prisma.ticketMessage.findFirstOrThrow({ where: { authorId: c.id } });
    await acknowledgeAdvice(l.id, advice.id);
    const acked = await prisma.ticketMessage.findUniqueOrThrow({ where: { id: advice.id } });
    expect(acked.outcomeDueAt!.getTime() - acked.acknowledgedAt!.getTime()).toBe(72 * H);
    expect((await prisma.ticketMessage.findFirstOrThrow({ where: { kind: "ACK" } })).body).toContain("72 h");
    await expect(reportOutcome(l.id, advice.id, false, "")).rejects.toThrow("Explique");
    await reportOutcome(l.id, advice.id, false, "Toujours 200 vues");
    expect(await prisma.responseWait.count({ where: { ticketId: t.id, answeredAt: null } })).toBe(1);
  });

  it("seul le coach clôture ; l'élève note ensuite (😞 et 😐 justifiés)", async () => {
    const c = await coach("Coach");
    const l = await learner("eleve", c.id);
    const t = await openLearnerTicket(l.id, { subject: "Q", body: "?", imageKeys: [] });
    await expect(closeTicket({ id: l.id, role: "LEARNER" }, t.id)).rejects.toThrow("Seul le coach");
    await expect(rateTicket(l.id, t.id, "GOOD", "")).rejects.toThrow("clôturée");
    await closeTicket({ id: c.id, role: "COACH" }, t.id);
    await expect(rateTicket(l.id, t.id, "BAD", "")).rejects.toThrow("Explique");
    await rateTicket(l.id, t.id, "BAD", "Réponse trop vague");
    const report = (await coachReport())[0];
    expect(report.ratingCounts.BAD).toBe(1);
    expect(report.ratings[0]).toMatchObject({ ticketId: t.id, comment: "Réponse trop vague" });
  });

  it("questions de suivi en masse : un seul ticket de suivi ouvert par élève", async () => {
    const c = await coach("Coach");
    const a = await learner("a", c.id);
    const b = await learner("b", c.id);
    const stranger = await learner("x", null);
    expect(await sendFollowUps(c.id, "problems", [a.id, b.id, stranger.id])).toEqual({ sent: 2, skipped: 1 });
    expect(await sendFollowUps(c.id, "satisfaction", [a.id])).toEqual({ sent: 0, skipped: 1 });
  });
});

describe("Posts, streak, preuves et rangs", () => {
  beforeEach(resetDb);

  it("un post doit être sur le compte de l'élève, une seule fois", async () => {
    const c = await coach("Coach");
    const l = await learner("ines.demo", c.id, new Date(Date.now() - 3 * D));
    await updateCoachingProfile(l.id, { tiktokUsername: "@Ines.Demo", timezone: "Europe/Paris" });
    const id = idFor(new Date(Date.now() - D));
    await expect(addPost(l.id, `https://www.tiktok.com/@autre/video/${id}`)).rejects.toThrow("pas sur ton compte");
    await addPost(l.id, `https://www.tiktok.com/@ines.demo/video/${id}`);
    await expect(addPost(l.id, `https://www.tiktok.com/@ines.demo/video/${id}?lang=fr`)).rejects.toThrow("déjà");
    await addPost(l.id, `https://www.tiktok.com/@ines.demo/video/${idFor(new Date())}`);
    expect((await getStreak(l.id)).current).toBeGreaterThanOrEqual(2);
  });

  it("vues validées par le coach → points ; un autre coach ne peut pas valider", async () => {
    const c = await coach("Coach");
    const intruder = await coach("Intrus", 3, 20, 2);
    const l = await learner("ines", c.id, new Date(Date.now() - D));
    const post = await addPost(l.id, `https://www.tiktok.com/@ines/video/${idFor(new Date())}`);
    await expect(submitViewProof(l.id, post.id, { views: 5_000, likes: 10, comments: 1 }, img(l.id))).rejects.toThrow("10 000");
    await submitViewProof(l.id, post.id, { views: 150_000, likes: 9_000, comments: 120 }, img(l.id));
    const proof = await prisma.viewProof.findFirstOrThrow();
    expect(proof).toMatchObject({ likes: 9_000, comments: 120 });
    await expect(reviewViewProof({ id: intruder.id, role: "COACH" }, proof.id, true, undefined, "", true)).rejects.toThrow("introuvable");
    await expect(reviewViewProof({ id: c.id, role: "COACH" }, proof.id, true, 320_000)).rejects.toThrow("concordent");
    await reviewViewProof({ id: c.id, role: "COACH" }, proof.id, true, 320_000, "", true);
    const board = await leaderboard();
    expect(board[0]).toMatchObject({ displayName: "ines", points: 3 }); // 320 000 vues = 3 points
  });

  it("résultats du mois : fenêtre, rang S, puis SSS = coaching terminé et place libérée", async () => {
    const c = await coach("Coach");
    const l = await learner("ines", c.id);
    const video = `https://www.tiktok.com/@ines/video/${idFor(new Date("2026-10-20T12:00:00Z"))}`;
    await expect(submitMonthlyProof(l.id, 150, [video], img(l.id), new Date("2026-10-15T12:00:00Z"))).rejects.toThrow("dernier jour");
    await expect(submitMonthlyProof(l.id, 150, [], img(l.id), new Date("2026-10-31T12:00:00Z"))).rejects.toThrow("au moins une vidéo");
    await expect(submitMonthlyProof(l.id, 150, [`https://www.tiktok.com/@autre/video/${idFor(new Date())}`], img(l.id), new Date("2026-10-31T12:00:00Z"))).rejects.toThrow("pas sur ton compte");
    await submitMonthlyProof(l.id, 150, [video], img(l.id), new Date("2026-10-31T12:00:00Z"));
    expect((await prisma.rankProof.findFirstOrThrow()).videoUrls).toEqual([video]);
    await reviewRankProof({ id: c.id, role: "COACH" }, (await prisma.rankProof.findFirstOrThrow()).id, true, "", true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: l.id } })).manualRank).toBe("S");
    await submitMonthlyProof(l.id, 1200, [video], img(l.id), new Date("2026-12-02T12:00:00Z"));
    await reviewRankProof({ id: c.id, role: "COACH" }, (await prisma.rankProof.findFirstOrThrow({ where: { status: "PENDING" } })).id, true, "", true);
    const done = await prisma.user.findUniqueOrThrow({ where: { id: l.id } });
    expect(done).toMatchObject({ manualRank: "SSS", coachingStatus: "COMPLETED" });
    expect((await prisma.user.count({ where: { coachId: c.id, coachingStatus: "ACTIVE" } }))).toBe(0);
  });
});

describe("Absence et réactivation", () => {
  beforeEach(resetDb);

  it("15 jours sans post : coaching révoqué ; demande de réactivation validée par un coach", async () => {
    const c = await coach("Coach");
    const l = await learner("ines", c.id, new Date(Date.now() - 16 * D));
    await prisma.auditLog.create({ data: { actorUserId: l.id, action: "COACHING_STARTED", entityType: "user", entityId: l.id, metadata: { coachId: c.id } } });
    expect(await processAbsences()).toBe(1);
    const revoked = await prisma.user.findUniqueOrThrow({ where: { id: l.id } });
    expect(revoked).toMatchObject({ coachingStatus: "REVOKED", coachId: null });
    await expect(requestReactivation(l.id, "court")).rejects.toThrow("20 caractères");
    await requestReactivation(l.id, "J'étais hospitalisé pendant deux semaines.");
    const req = await prisma.reactivationRequest.findFirstOrThrow();
    await decideReactivation(c.id, req.id, true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ coachingStatus: "ACTIVE", coachId: c.id });
  });

  it("un élève actif depuis moins de 15 jours n'est pas révoqué", async () => {
    const c = await coach("Coach");
    await learner("ines", c.id, new Date(Date.now() - 14 * D));
    expect(await processAbsences()).toBe(0);
  });
});

describe("Équipe de coachs", () => {
  beforeEach(resetDb);

  it("ajoute un coach à la suite, refuse de retirer un coach qui suit des élèves", async () => {
    const first = await coach("Coach 1");
    const u = await prisma.user.create({ data: { displayName: "Sam", role: "LEARNER", learnCompletedAt: new Date() } });
    const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
    const fresh = await prisma.user.create({ data: { displayName: "Nouveau", role: "LEARNER" } });
    expect((await listCoachCandidates()).map((c) => c.displayName)).toEqual(["Sam"]);
    await expect(addCoach(admin.id, fresh.id)).rejects.toThrow("terminé toute la formation");
    await addCoach(admin.id, u.id);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ role: "COACH", coachOrder: 2, coachStars: 3 });
    await expect(addCoach(admin.id, u.id)).rejects.toThrow(CoachingError);

    await learner("Lea", first.id);
    await expect(removeCoach(admin.id, first.id)).rejects.toThrow("suit encore 1 élève");
    await removeCoach(admin.id, u.id);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ role: "LEARNER", coachOrder: null });
  });
});
