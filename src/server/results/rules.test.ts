import { describe, expect, it } from "vitest";
import { dailyCode, normalizeIdentifier, parseTiers, pointsGained, resultPoints, specialRank } from "./rules";

const VIDEO = { points: 0, metric: "VIEWS" as const, tiers: [{ min: 100_000, points: 2 }, { min: 10_000, points: 1 }, { min: 1_000_000, points: 5 }] };

describe("résultats : règles", () => {
  it("paliers triés, points selon le chiffre lu, 0 sous le premier palier", () => {
    expect(parseTiers([{ min: 5, points: 1 }, { min: -1, points: 2 }, { min: 5, points: 3 }, "x"])).toEqual([{ min: 5, points: 3 }]);
    expect(resultPoints(VIDEO, 9_999)).toBe(0);
    expect(resultPoints(VIDEO, 634_200)).toBe(2);
    expect(resultPoints(VIDEO, 1_400_000)).toBe(5);
    expect(resultPoints(VIDEO, null)).toBe(0);
  });

  it("points fixes quand il n'y a ni chiffre ni palier", () => {
    expect(resultPoints({ points: 5, metric: "NONE", tiers: [] }, null)).toBe(5);
    expect(resultPoints({ points: 4, metric: "VIEWS", tiers: [] }, 12)).toBe(4);
  });

  it("un même résultat ne rapporte que la différence", () => {
    expect(pointsGained(4, 0)).toBe(4);
    expect(pointsGained(5, 4)).toBe(1);
    expect(pointsGained(2, 4)).toBe(0);
  });

  it("code du jour : stable, propre au membre et au jour", () => {
    const a = dailyCode("secret", "u1", "2026-10-04");
    expect(a).toMatch(/^CR-\d{4}$/);
    expect(dailyCode("secret", "u1", "2026-10-04")).toBe(a);
    expect([dailyCode("secret", "u2", "2026-10-04"), dailyCode("secret", "u1", "2026-10-05")]).not.toContain(a);
  });

  it("rangs spéciaux : A à 10 000 abonnés, S / SS / SSS selon les revenus du mois", () => {
    expect(specialRank("FOLLOWERS_RANK", 9_999)).toBeNull();
    expect(specialRank("FOLLOWERS_RANK", 12_000)).toBe("A");
    expect(specialRank("MONTHLY_REVENUE", 99)).toBeNull();
    expect(specialRank("MONTHLY_REVENUE", 640)).toBe("SS");
    expect(specialRank("MONTHLY_REVENUE", 1_000)).toBe("SSS");
    expect(specialRank("NONE", 5_000)).toBeNull();
  });

  it("identifiant normalisé", () => {
    expect(normalizeIdentifier("  Posted on Sep 17,  2026 ")).toBe("posted on sep 17, 2026");
    expect(normalizeIdentifier("")).toBeNull();
  });
});
