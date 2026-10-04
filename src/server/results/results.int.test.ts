import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { prisma } from "@/server/db";
import { filePath } from "@/server/storage/storage";
import { setScreenshotReaderForTests } from "@/server/ai";
import { AIError } from "@/server/ai/types";
import type { ScreenshotReader } from "@/server/ai/screenshot";
import { leaderboard } from "@/server/coaching/progress";
import { resetDb } from "../../../tests/db";
import { createResult, isPublicResultImage, listGallery, listPendingResults, listResultPosts, monthlyRevenues, processResultRead, reactToPost, ResultPostError, reviewResult } from "./service";
import { deleteResultType, saveResultType } from "./types-admin";
import { setAvailability, availabilityFor } from "@/server/coaching/availability";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const img = (owner: string, n = 1) => `uploads/${owner}/0000000${n}-0000-4000-8000-000000000000.png`;
const now = new Date("2026-10-07T10:00:00Z");

// Capture réelle sur le disque (contenu différent pour chaque n).
async function upload(owner: string, n = 1) {
  const key = img(owner, n);
  await mkdir(dirname(filePath(key)), { recursive: true });
  await writeFile(filePath(key), Buffer.concat([PNG, Buffer.from(`capture ${owner} ${n}`)]));
  return key;
}

async function team() {
  const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN", coachingStatus: "ACTIVE", timezone: "Europe/Paris" } });
  const coach = await prisma.user.create({ data: { displayName: "Coach", role: "COACH", coachOrder: 1, coachingStatus: "ACTIVE", timezone: "Europe/Paris" } });
  const learner = await prisma.user.create({
    data: { displayName: "Léa", role: "LEARNER", coachId: coach.id, coachingStatus: "ACTIVE", coachingStartedAt: new Date("2026-09-01"), timezone: "Africa/Abidjan" },
  });
  const fresh = await prisma.user.create({ data: { displayName: "Nouveau", role: "LEARNER" } });
  return { admin, coach, learner, fresh };
}

const base = { instructions: "", exampleKey: null, aiMustHave: "", aiMustNotHave: "", aiIdentifier: "", isActive: true };
async function types(adminId: string) {
  const video = await saveResultType(adminId, {
    ...base,
    id: null,
    name: "Résultat d'une vidéo",
    aiIdentifier: "date de publication",
    points: 0,
    metric: "VIEWS",
    tiers: [{ min: 10_000, points: 1 }, { min: 100_000, points: 2 }, { min: 300_000, points: 3 }, { min: 500_000, points: 4 }, { min: 1_000_000, points: 5 }],
  });
  const monetized = await saveResultType(adminId, { ...base, id: null, name: "Nouveau compte monétisé", points: 5, metric: "NONE", tiers: [] });
  const monthly = await prisma.resultType.create({
    data: { name: "Revenus du mois", metric: "REVENUE_EUR", special: "MONTHLY_REVENUE", tiers: [{ min: 0, points: 2 }, { min: 100, points: 3 }, { min: 500, points: 5 }, { min: 1000, points: 8 }] },
  });
  const followers = await prisma.resultType.create({ data: { name: "10 000 abonnés", points: 3, metric: "FOLLOWERS", special: "FOLLOWERS_RANK" } });
  return { video, monetized, monthly, followers };
}

// Lecteur de captures contrôlé par le test.
function reader(verdict: Partial<Awaited<ReturnType<ScreenshotReader["read"]>>> | Error): ScreenshotReader {
  return {
    async read() {
      if (verdict instanceof Error) throw verdict;
      return { conforms: true, problems: [], codeFound: true, forbiddenFound: false, metricValue: null, identifier: null, summary: "ok", model: "test", ...verdict };
    },
  };
}

async function send(userId: string, typeId: string, n: number, title = "Mon résultat", at = now) {
  const post = await createResult(userId, { typeId, title, body: "", imageKey: await upload(userId, n) }, at);
  await processResultRead(post.id);
  return prisma.resultPost.findUniqueOrThrow({ where: { id: post.id } });
}

beforeEach(resetDb);
afterEach(() => setScreenshotReaderForTests(null));

describe("Résultats : capture lue par l'IA", () => {
  it("conforme → publié tout de suite avec les points des paliers ; un même résultat ne rapporte que la différence", async () => {
    const { learner, admin } = await team();
    const t = await types(admin.id);
    setScreenshotReaderForTests(reader({ metricValue: 634_200, identifier: "Posted on Sep 17, 2026, 7:44 PM" }));
    const p = await send(learner.id, t.video.id, 1);
    expect(p).toMatchObject({ status: "APPROVED", metricValue: 634_200, points: 4, identifier: "posted on sep 17, 2026, 7:44 pm" });
    expect(p.dailyCode).toMatch(/^CR-\d{4}$/);
    expect(await isPublicResultImage(p.imageKey)).toBe(true);
    // La même vidéo passe le million plus tard : +1 seulement.
    setScreenshotReaderForTests(reader({ metricValue: 1_200_000, identifier: "Posted on Sep 17, 2026, 7:44 PM" }));
    const again = await send(learner.id, t.video.id, 2, "Le million !", new Date("2026-10-08T10:00:00Z"));
    expect(again).toMatchObject({ status: "APPROVED", points: 1 });
    expect((await leaderboard(new Date("2026-10-08T10:00:00Z"))).find((r) => r.id === learner.id)?.points).toBeGreaterThanOrEqual(5);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: learner.id, kind: "resultPost.reviewed" }, orderBy: { createdAt: "asc" } });
    expect(n.text).toContain("+4 points");
  });

  it("non conforme → vérifié par le coach, qui corrige le chiffre ; un autre coach ne peut pas", async () => {
    const { learner, coach, admin } = await team();
    const t = await types(admin.id);
    const intruder = await prisma.user.create({ data: { displayName: "Intrus", role: "COACH", coachOrder: 2 } });
    setScreenshotReaderForTests(reader({ conforms: false, codeFound: false, problems: ["On voit la vidéo en haut."], metricValue: 50_000 }));
    const p = await send(learner.id, t.video.id, 1);
    expect(p.status).toBe("PENDING");
    expect((await prisma.notification.findFirstOrThrow({ where: { userId: learner.id, kind: "resultPost.checking" } })).text).toContain("On voit la vidéo en haut.");
    const [pending] = await listPendingResults(coach);
    expect(pending).toMatchObject({ metricValue: 50_000, aiProblems: ["On voit la vidéo en haut."], aiCodeFound: false });
    expect(await listPendingResults(intruder)).toHaveLength(0);
    await expect(reviewResult(intruder, p.id, { approve: true })).rejects.toThrow(ResultPostError);
    await expect(reviewResult(coach, p.id, { approve: false })).rejects.toThrow("Explique");
    await reviewResult(coach, p.id, { approve: true, metricValue: 120_000 }, now);
    expect(await prisma.resultPost.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "APPROVED", metricValue: 120_000, points: 2 });
  });

  it("IA en panne → vérification à la main ; résultat d'un coach → vérifié par l'admin", async () => {
    const { coach, admin } = await team();
    const t = await types(admin.id);
    setScreenshotReaderForTests(reader(new AIError("panne")));
    const p = await send(coach.id, t.monetized.id, 1);
    expect(p.status).toBe("PENDING");
    expect(await listPendingResults(coach)).toHaveLength(0);
    expect(await listPendingResults(admin)).toHaveLength(1);
    await reviewResult(admin, p.id, { approve: true });
    expect((await prisma.resultPost.findUniqueOrThrow({ where: { id: p.id } })).points).toBe(5);
  });

  it("réservé au coaching ; capture à soi ; même capture refusée ; 2 résultats par jour", async () => {
    const { learner, fresh, coach, admin } = await team();
    const t = await types(admin.id);
    await expect(createResult(fresh.id, { typeId: t.monetized.id, title: "Mon post", body: "", imageKey: await upload(fresh.id) }, now)).rejects.toThrow("après la formation");
    await expect(createResult(learner.id, { typeId: t.monetized.id, title: "Vues", body: "", imageKey: await upload(coach.id) }, now)).rejects.toThrow("capture");
    const key = await upload(learner.id, 1);
    await createResult(learner.id, { typeId: t.monetized.id, title: "Premier", body: "", imageKey: key }, now);
    await expect(createResult(learner.id, { typeId: t.monetized.id, title: "Doublon", body: "", imageKey: key }, now)).rejects.toThrow("déjà envoyé cette capture");
    await createResult(learner.id, { typeId: t.monetized.id, title: "Second", body: "", imageKey: await upload(learner.id, 2) }, now);
    await expect(createResult(learner.id, { typeId: t.monetized.id, title: "Troisième", body: "", imageKey: await upload(learner.id, 3) }, now)).rejects.toThrow("2 résultats par jour");
  });

  it("revenus du mois : dernier jour seulement, rang S, puis SSS = coaching terminé ; abonnés → rang A", async () => {
    const { learner, admin } = await team();
    const t = await types(admin.id);
    setScreenshotReaderForTests(reader({ metricValue: 150 }));
    await expect(createResult(learner.id, { typeId: t.monthly.id, title: "Octobre", body: "", imageKey: await upload(learner.id, 1) }, new Date("2026-10-15T12:00:00Z"))).rejects.toThrow("dernier jour");
    const oct = await send(learner.id, t.monthly.id, 2, "Octobre", new Date("2026-10-31T12:00:00Z"));
    expect(oct).toMatchObject({ status: "APPROVED", month: "2026-10", points: 3 });
    await expect(createResult(learner.id, { typeId: t.monthly.id, title: "Encore", body: "", imageKey: await upload(learner.id, 3) }, new Date("2026-10-31T13:00:00Z"))).rejects.toThrow("déjà envoyés");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).manualRank).toBe("S");
    setScreenshotReaderForTests(reader({ metricValue: 12_000 }));
    await send(learner.id, t.followers.id, 4, "10K", new Date("2026-11-02T12:00:00Z"));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).manualRank).toBe("S"); // A < S : le meilleur reste
    setScreenshotReaderForTests(reader({ metricValue: 1_250 }));
    await send(learner.id, t.monthly.id, 5, "Novembre", new Date("2026-11-30T12:00:00Z"));
    expect(await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).toMatchObject({ manualRank: "SSS", coachingStatus: "COMPLETED" });
    expect((await monthlyRevenues(learner.id)).map((m) => [m.month, m.amountEur, m.isBest])).toEqual([
      ["2026-11", 1250, true],
      ["2026-10", 150, false],
    ]);
  });

  it("galerie : tous les résultats publiés, du plus récent au plus ancien, filtre par type", async () => {
    const { learner, coach, admin } = await team();
    const t = await types(admin.id);
    setScreenshotReaderForTests(reader({ metricValue: 20_000, identifier: "a" }));
    await send(learner.id, t.video.id, 1, "Vidéo", new Date("2026-10-07T08:00:00Z"));
    await send(coach.id, t.monetized.id, 1, "Monétisé", new Date("2026-10-07T09:00:00Z"));
    setScreenshotReaderForTests(reader({ conforms: false }));
    await send(learner.id, t.video.id, 2, "En attente", new Date("2026-10-07T10:00:00Z"));
    const all = await listGallery(admin.id);
    expect(all.items.map((i) => i.title)).toEqual(["Monétisé", "Vidéo"]);
    expect(all.items[0]).toMatchObject({ author: "Coach", typeName: "Nouveau compte monétisé", points: 5 });
    expect((await listGallery(admin.id, { typeId: t.video.id })).items.map((i) => i.title)).toEqual(["Vidéo"]);
    expect((await listResultPosts(learner.id, learner.id)).map((p) => p.status)).toEqual(["PENDING", "APPROVED"]);
    expect(await listResultPosts(learner.id, coach.id)).toHaveLength(1);
  });

  it("une réaction par membre et par résultat : choisir, changer, retirer", async () => {
    const { admin, learner, coach } = await team();
    const t = await types(admin.id);
    const p = await send(admin.id, t.monetized.id, 1, "Record");
    await reactToPost(learner.id, p.id, "FIRE");
    await reactToPost(coach.id, p.id, "FIRE");
    await reactToPost(learner.id, p.id, "ROCKET");
    let [view] = await listResultPosts(admin.id, learner.id);
    expect(view.counts).toEqual({ FIRE: 1, ROCKET: 1, ANGRY: 0, CRY: 0 });
    expect(view.mine).toBe("ROCKET");
    await reactToPost(learner.id, p.id, null);
    [view] = await listResultPosts(admin.id, learner.id);
    expect(view.counts.ROCKET).toBe(0);
    expect(view.mine).toBeNull();
  });

  it("types : un type utilisé est masqué au lieu d'être supprimé ; un type spécial ne se supprime pas", async () => {
    const { admin, learner } = await team();
    const t = await types(admin.id);
    const unused = await saveResultType(admin.id, { ...base, id: null, name: "Semaine", points: 2, metric: "NONE", tiers: [] });
    expect(await deleteResultType(admin.id, unused.id)).toEqual({ hidden: false });
    await send(learner.id, t.monetized.id, 1);
    expect(await deleteResultType(admin.id, t.monetized.id)).toEqual({ hidden: true });
    expect((await prisma.resultType.findUniqueOrThrow({ where: { id: t.monetized.id } })).isActive).toBe(false);
    await expect(deleteResultType(admin.id, t.monthly.id)).rejects.toThrow("spécial");
    await expect(createResult(learner.id, { typeId: t.monetized.id, title: "Encore", body: "", imageKey: await upload(learner.id, 2) }, now)).rejects.toThrow("n'existe plus");
  });
});

describe("Disponibilités des coachs", () => {
  it("enregistre la semaine et l'envoie aux élèves dans leur fuseau", async () => {
    const { coach, learner } = await team();
    const sunday = new Date("2026-10-04T18:00:00Z"); // dimanche 20 h à Paris
    await expect(setAvailability(coach.id, [{ weekday: 0, start: "23:00", end: "21:00" }], sunday)).rejects.toThrow("après");
    expect(await setAvailability(coach.id, [{ weekday: 0, start: "21:00", end: "23:00" }, { weekday: 1, start: "19:00", end: "22:00" }], sunday)).toBe(1);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: learner.id, kind: "coach.availability" } });
    expect(n.text).toContain("• Lundi 19:00–21:00"); // Abidjan = Paris − 2 h en octobre
    expect((await availabilityFor(coach.id, "Europe/Paris", sunday)).lines).toEqual(["Lundi 21:00–23:00", "Mardi 19:00–22:00"]);
  });
});
