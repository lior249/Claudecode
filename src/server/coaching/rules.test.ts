import { describe, expect, it } from "vitest";
import {
  activityGrid,
  computeStreak,
  isoWeek,
  localDate,
  maxRank,
  monthlyWindow,
  parseTikTokUrl,
  rankFromMonthlyAmount,
  viewPoints,
} from "./rules";

// Identifiant TikTok fabriqué pour une date donnée (secondes << 32).
const idFor = (iso: string) => (BigInt(Math.floor(new Date(iso).getTime() / 1000)) << BigInt(32)) + BigInt(123456);

describe("liens TikTok", () => {
  it("lit le compte et la date de publication dans le lien", () => {
    const id = idFor("2026-10-01T18:30:00Z");
    const p = parseTikTokUrl(`https://www.tiktok.com/@Mon.Compte/video/${id}?is_from_webapp=1`);
    expect(p).toEqual({ username: "mon.compte", videoId: String(id), postedAt: new Date("2026-10-01T18:30:00Z") });
  });
  it("refuse les liens qui ne sont pas des vidéos TikTok", () => {
    expect(parseTikTokUrl("https://evil.com/@a/video/7300000000000000000")).toBeNull();
    expect(parseTikTokUrl("https://www.tiktok.com/@abc")).toBeNull();
    expect(parseTikTokUrl("pas un lien")).toBeNull();
  });
  it("jour local selon le fuseau de l'élève", () => {
    const d = new Date("2026-10-01T23:30:00Z");
    expect(localDate(d, "Europe/Paris")).toBe("2026-10-02");
    expect(localDate(d, "America/Montreal")).toBe("2026-10-01");
  });
});

describe("streak", () => {
  const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => new Date(new Date(`${start}T12:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10));

  it("compte les jours d'affilée ; aujourd'hui sans post ne casse pas encore la chaîne", () => {
    const r = computeStreak(days("2026-10-01", 5), "2026-10-01", "2026-10-06");
    expect(r).toMatchObject({ current: 5, best: 5, todayDone: false, flame: 1 });
  });
  it("+1 point par semaine complète", () => {
    expect(computeStreak(days("2026-10-01", 14), "2026-10-01", "2026-10-14").points).toBe(2);
  });
  it("le gel couvre un seul jour manqué par mois", () => {
    const posts = [...days("2026-10-01", 5), ...days("2026-10-07", 3)]; // 6 octobre manqué
    const r = computeStreak(posts, "2026-10-01", "2026-10-09");
    expect(r).toMatchObject({ current: 9, frozenDays: ["2026-10-06"] });
    const r2 = computeStreak([...days("2026-10-01", 5), ...days("2026-10-07", 2), ...days("2026-10-10", 2)], "2026-10-01", "2026-10-11");
    expect(r2.current).toBe(2); // 2e jour manqué dans le mois : chaîne cassée
    expect(r2.best).toBe(8);
  });
  it("bonus à 30 jours (+3) et flamme qui évolue", () => {
    const r = computeStreak(days("2026-01-01", 30), "2026-01-01", "2026-01-30");
    expect(r.points).toBe(4 + 3);
    expect(r.flame).toBe(3);
  });
});

describe("points, rangs et fenêtres", () => {
  it("barème des vues", () => {
    expect([9_999, 10_000, 99_999, 100_000, 300_000, 500_000, 999_999, 1_000_000].map(viewPoints)).toEqual([0, 1, 1, 2, 3, 4, 4, 5]);
  });
  it("rangs selon les euros d'un seul mois", () => {
    expect([99, 100, 499, 500, 999, 1000].map(rankFromMonthlyAmount)).toEqual([null, "S", "S", "SS", "SS", "SSS"]);
    expect(maxRank("B", "S")).toBe("S");
    expect(maxRank("SS", "A")).toBe("SS");
  });
  it("résultats du mois : du dernier jour au 5 du mois suivant", () => {
    expect(monthlyWindow("2026-10-31")).toEqual({ open: true, month: "2026-10" });
    expect(monthlyWindow("2026-11-05")).toEqual({ open: true, month: "2026-10" });
    expect(monthlyWindow("2026-01-03")).toEqual({ open: true, month: "2025-12" });
    expect(monthlyWindow("2026-11-06")).toEqual({ open: false, month: null });
    expect(monthlyWindow("2028-02-29")).toEqual({ open: true, month: "2028-02" });
  });
  it("semaine ISO pour compter les retards", () => {
    expect(isoWeek(new Date("2026-10-05T10:00:00Z"))).toBe("2026-W41");
    expect(isoWeek(new Date("2026-10-04T23:00:00Z"))).toBe("2026-W40");
  });
});

describe("grille de régularité", () => {
  it("place les jours en colonnes de semaines et calcule le pourcentage", () => {
    // 2026-10-07 = mercredi ; coaching commencé le lundi 05.
    const g = activityGrid(["2026-10-05", "2026-10-07"], ["2026-10-06"], "2026-10-05", "2026-10-07", 2);
    expect(g.weeks).toHaveLength(2);
    expect(g.weeks[0][0].day).toBe("2026-09-28"); // lundi
    expect(g.weeks[1].map((c) => c.state)).toEqual(["posted", "frozen", "posted", "future", "future", "future", "future"]);
    expect(g.weeks[0].every((c) => c.state === "before")).toBe(true);
    expect(g.percent).toBe(67); // 2 postés sur 3 jours (le gel compte comme non posté)
    expect(g.thisWeek[2]).toBe("posted");
  });

  it("aujourd'hui non posté ne fait pas baisser le pourcentage", () => {
    const g = activityGrid(["2026-10-05"], [], "2026-10-05", "2026-10-06", 1);
    expect(g.percent).toBe(100);
    expect(g.weeks[0][1].state).toBe("missed");
  });
});
