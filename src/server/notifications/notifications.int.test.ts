import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { resetDb, seedCourse } from "../../../tests/db";

const send = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/discord/api", async (orig) => ({ ...(await orig<typeof import("@/server/discord/api")>()), botConfigured: () => true, botSendDirectMessage: send }));

const { deliverPendingDms, notify, unreadCount, markAllRead } = await import("./service");
const { runEngagement } = await import("./engagement");
const { completeLesson } = await import("@/server/learn/service");

const H = 3_600_000;
// 2026-10-07 = mercredi ; Europe/Paris = UTC+2 en octobre.
const paris = (hhmm: string, day = "2026-10-07") => new Date(`${day}T${hhmm}:00+02:00`);
const idFor = (d: Date) => (BigInt(Math.floor(d.getTime() / 1000)) << BigInt(32)) + BigInt(42);

async function user(data: Partial<Parameters<typeof prisma.user.create>[0]["data"]> = {}) {
  return prisma.user.create({ data: { displayName: "Léa", role: "LEARNER", discordUserId: `d${Math.random()}`, timezone: "Europe/Paris", ...data } });
}

beforeEach(async () => {
  await resetDb();
  send.mockClear();
});

describe("Notifications : cloche et messages privés", () => {
  it("une clé unique ne crée la notification qu'une fois ; dm:false reste dans la cloche", async () => {
    const u = await user();
    expect(await notify(u.id, { kind: "t", text: "a", onceKey: "k" })).not.toBeNull();
    expect(await notify(u.id, { kind: "t", text: "a", onceKey: "k" })).toBeNull();
    const inApp = await notify(u.id, { kind: "t", text: "b", dm: false });
    expect(inApp?.dmStatus).toBe("SKIPPED");
    expect(await unreadCount(u.id)).toBe(2);
    await markAllRead(u.id);
    expect(await unreadCount(u.id)).toBe(0);
  });

  it("heures calmes : attend le matin, sauf urgence", async () => {
    const u = await user();
    const night = paris("23:30");
    await prisma.notification.create({ data: { userId: u.id, kind: "t", text: "calme", createdAt: night } });
    await prisma.notification.create({ data: { userId: u.id, kind: "t", text: "urgent", urgent: true, createdAt: night } });
    expect(await deliverPendingDms(night)).toBe(1);
    expect(send).toHaveBeenCalledWith(u.discordUserId, "urgent", null); // pas d'image de mascotte hors https
    expect(await deliverPendingDms(paris("08:05", "2026-10-08"))).toBe(1);
    expect(send).toHaveBeenLastCalledWith(u.discordUserId, "calme", null);
  });

  it("3 messages non urgents par jour au maximum, le reste dans la cloche ; lien ajouté", async () => {
    const u = await user();
    const t = paris("12:00");
    for (let i = 0; i < 5; i++) await prisma.notification.create({ data: { userId: u.id, kind: "t", text: `n${i}`, href: "/learn", createdAt: t } });
    expect(await deliverPendingDms(t)).toBe(3);
    expect(send).toHaveBeenCalledWith(u.discordUserId, "n0\nhttp://localhost:3000/learn", null);
    expect(await prisma.notification.count({ where: { userId: u.id, dmStatus: "SKIPPED" } })).toBe(2);
  });

  it("messages privés désactivés : seulement la cloche", async () => {
    const u = await user({ dmEnabled: false });
    await notify(u.id, { kind: "t", text: "x" });
    await deliverPendingDms(paris("12:00"));
    expect(send).not.toHaveBeenCalled();
  });
});

describe("Relances façon Duolingo", () => {
  it("élève absent du Learn : relance à son heure, une fois par jour", async () => {
    const { learner } = await seedCourse(["UNDERSTANDING"]);
    await prisma.user.update({ where: { id: learner.id }, data: { timezone: "Europe/Paris", learnStartedAt: paris("10:00", "2026-10-04"), lastSeenAt: paris("10:00", "2026-10-05") } });
    await runEngagement(paris("18:00"));
    expect(await prisma.notification.count({ where: { userId: learner.id } })).toBe(0); // avant 19 h
    await runEngagement(paris("19:10"));
    await runEngagement(paris("19:15"));
    const notes = await prisma.notification.findMany({ where: { userId: learner.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain("2 jours");
  });

  it("flamme en danger, dernière chance, et rien si le post du jour est fait", async () => {
    const start = paris("10:00", "2026-10-01");
    const l = await user({ coachingStatus: "ACTIVE", coachingStartedAt: start, tiktokUsername: "lea" });
    for (const day of ["2026-10-05", "2026-10-06"]) {
      const d = paris("12:00", day);
      await prisma.post.create({ data: { learnerId: l.id, url: "u" + day, videoId: idFor(d).toString(), postedAt: d, localDate: day } });
    }
    await runEngagement(paris("19:05"));
    await runEngagement(paris("21:05"));
    const kinds = (await prisma.notification.findMany({ where: { userId: l.id }, orderBy: { createdAt: "asc" } })).map((n) => n.kind);
    expect(kinds).toEqual(["streak.risk", "streak.lastChance"]);

    const other = await user({ coachingStatus: "ACTIVE", coachingStartedAt: start, tiktokUsername: "max" });
    const today = paris("09:00");
    await prisma.post.create({ data: { learnerId: other.id, url: "u-max", videoId: idFor(today).toString(), postedAt: today, localDate: "2026-10-07" } });
    await runEngagement(paris("19:30"));
    expect(await prisma.notification.count({ where: { userId: other.id, kind: { startsWith: "streak" } } })).toBe(0);
  });

  it("résumé du matin du coach, seulement s'il a quelque chose à faire", async () => {
    const coach = await user({ role: "COACH", displayName: "Coach", coachOrder: 1 });
    await runEngagement(paris("09:30"));
    expect(await prisma.notification.count({ where: { userId: coach.id } })).toBe(0);
    const l = await user({ coachingStatus: "ACTIVE", coachId: coach.id, tiktokUsername: "lea" });
    const t = await prisma.ticket.create({ data: { learnerId: l.id, coachId: coach.id, origin: "LEARNER", subject: "Aide" } });
    await prisma.responseWait.create({ data: { ticketId: t.id, coachId: coach.id, askedAt: paris("08:00"), dueAt: paris("20:00") } });
    await runEngagement(paris("09:40"));
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: coach.id } });
    expect(n.text).toBe("Ta journée de coach : 1 réponse à donner.");
  });

  it("fin de module fêtée une seule fois", async () => {
    const { learner, lessons } = await seedCourse(["UNDERSTANDING", "UNDERSTANDING"]);
    await prisma.module.create({ data: { levelId: (await prisma.level.findFirstOrThrow()).id, title: "Module 2", position: 2 } }).then((m) =>
      prisma.lesson.create({ data: { moduleId: m.id, title: "Suite", type: "UNDERSTANDING", position: 1 } }),
    );
    await prisma.user.update({ where: { id: learner.id }, data: { learnStartedAt: new Date(Date.now() - H) } });
    await completeLesson(learner.id, lessons[0].id, 20);
    expect(await prisma.notification.count({ where: { userId: learner.id } })).toBe(0);
    await completeLesson(learner.id, lessons[1].id, 20);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: learner.id } });
    expect(n.text).toContain("Module « Module » terminé");
  });
});
