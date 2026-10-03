import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetDb } from "../../../tests/db";
import { createResultPost, isPublicResultImage, listPendingResultPosts, listResultPosts, reactToPost, ResultPostError, reviewResultPost } from "./service";
import { setAvailability, availabilityFor } from "@/server/coaching/availability";

const img = (owner: string, n = 1) => `uploads/${owner}/0000000${n}-0000-4000-8000-000000000000.png`;
const now = new Date("2026-10-07T10:00:00Z");

async function team() {
  const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN", coachingStatus: "ACTIVE", timezone: "Europe/Paris" } });
  const coach = await prisma.user.create({ data: { displayName: "Coach", role: "COACH", coachOrder: 1, coachingStatus: "ACTIVE", timezone: "Europe/Paris" } });
  const learner = await prisma.user.create({ data: { displayName: "Léa", role: "LEARNER", coachId: coach.id, coachingStatus: "ACTIVE", timezone: "Africa/Abidjan" } });
  const fresh = await prisma.user.create({ data: { displayName: "Nouveau", role: "LEARNER" } });
  return { admin, coach, learner, fresh };
}

beforeEach(resetDb);

describe("Posts de résultats", () => {
  it("élève → validé par son coach ; 2 posts par jour ; réservé au coaching", async () => {
    const { coach, learner, fresh, admin } = await team();
    await expect(createResultPost(fresh.id, { title: "Mon post", body: "", imageKey: img(fresh.id) }, now)).rejects.toThrow("après la formation");
    await expect(createResultPost(learner.id, { title: "Vues", body: "", imageKey: img(coach.id) }, now)).rejects.toThrow("capture");
    const p1 = await createResultPost(learner.id, { title: "1 500 € en une vidéo 🔥", body: "Incroyable", imageKey: img(learner.id), link: "https://www.tiktok.com/@lea/video/1" }, now);
    await createResultPost(learner.id, { title: "Second post", body: "", imageKey: img(learner.id, 2) }, now);
    await expect(createResultPost(learner.id, { title: "Troisième", body: "", imageKey: img(learner.id, 3) }, now)).rejects.toThrow("2 posts par jour");
    expect(p1.status).toBe("PENDING");
    expect(await listResultPosts(learner.id, coach.id)).toHaveLength(0); // pas encore publié pour les autres
    expect(await listResultPosts(learner.id, learner.id)).toHaveLength(2); // l'auteur voit ses posts en attente
    expect((await listPendingResultPosts(coach)).map((x) => x.title).sort()).toEqual(["1 500 € en une vidéo 🔥", "Second post"]);
    expect(await listPendingResultPosts(admin)).toHaveLength(2);
    await expect(reviewResultPost(coach, p1.id, false)).rejects.toThrow("Explique");
    await reviewResultPost(coach, p1.id, true, "", now);
    expect(await isPublicResultImage(img(learner.id))).toBe(true);
    expect(await isPublicResultImage(img(learner.id, 2))).toBe(false);
  });

  it("coach → validé par l'admin seulement ; admin → publié d'office", async () => {
    const { coach, admin } = await team();
    const other = await prisma.user.create({ data: { displayName: "Coach 2", role: "COACH", coachOrder: 2, coachingStatus: "ACTIVE" } });
    const p = await createResultPost(coach.id, { title: "Monétisé !", body: "", imageKey: img(coach.id) }, now);
    await expect(reviewResultPost(other, p.id, true)).rejects.toThrow(ResultPostError);
    expect(await listPendingResultPosts(other)).toHaveLength(0);
    await reviewResultPost(admin, p.id, true);
    const a = await createResultPost(admin.id, { title: "Mon record", body: "", imageKey: img(admin.id) }, now);
    expect(a.status).toBe("APPROVED");
  });

  it("une réaction par membre et par post : choisir, changer, retirer", async () => {
    const { admin, learner, coach } = await team();
    const p = await createResultPost(admin.id, { title: "Record", body: "", imageKey: img(admin.id) }, now);
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
