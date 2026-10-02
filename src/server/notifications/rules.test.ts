import { describe, expect, it } from "vitest";
import { adminDigest, clampReminderHour, coachDigest, dmDecision, isQuietHour, learnNudge, localHour, localWeekday, pick } from "./rules";

describe("notifications : règles", () => {
  it("heures calmes de 22 h à 8 h", () => {
    expect([21, 22, 23, 0, 7, 8].map(isQuietHour)).toEqual([false, true, true, true, true, false]);
  });

  it("décide du message privé", () => {
    const base = { urgent: false, hour: 12, sentToday: 0, ageMs: 0 };
    expect(dmDecision(base)).toBe("send");
    expect(dmDecision({ ...base, hour: 23 })).toBe("wait");
    expect(dmDecision({ ...base, hour: 23, urgent: true })).toBe("send");
    expect(dmDecision({ ...base, sentToday: 3 })).toBe("skip");
    expect(dmDecision({ ...base, sentToday: 3, urgent: true })).toBe("send");
    expect(dmDecision({ ...base, ageMs: 17 * 3_600_000 })).toBe("skip");
  });

  it("heure et jour locaux", () => {
    const d = new Date("2026-10-05T20:30:00Z"); // lundi
    expect(localHour(d, "Europe/Paris")).toBe(22);
    expect(localHour(d, "Africa/Abidjan")).toBe(20);
    expect(localWeekday(d, "Africa/Abidjan")).toBe(1);
    expect(localWeekday(d, "Asia/Tokyo")).toBe(2);
  });

  it("formulations stables et variées", () => {
    expect(pick(["a", "b", "c"], "x")).toBe(pick(["a", "b", "c"], "x"));
    const seen = new Set(["1", "2", "3", "4", "5", "6"].map((s) => learnNudge(1, "Cuts", s)));
    expect(seen.size).toBeGreaterThan(1);
    expect(learnNudge(14, null, "s")).toContain("14 jours");
  });

  it("heure de rappel bornée", () => {
    expect(clampReminderHour(3)).toBe(8);
    expect(clampReminderHour(23)).toBe(21);
    expect(clampReminderHour(1.5)).toBe(19);
  });

  it("résumés vides = pas de notification", () => {
    expect(coachDigest({ waits: 0, late: 0, proofs: 0, reactivations: 0 })).toBeNull();
    expect(coachDigest({ waits: 2, late: 1, proofs: 1, reactivations: 0 })).toBe("☀️ Ta journée de coach : 2 réponses à donner (dont 1 en retard), 1 preuve à vérifier.");
    expect(adminDigest({ reviews: 0, reactivations: 0, withoutCoach: 1, lowStarCoaches: 0, failedJobs: 0 })).toBe("🛠️ Résumé admin : 1 élève sans coach.");
  });
});
