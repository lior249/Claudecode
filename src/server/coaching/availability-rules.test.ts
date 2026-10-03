import { describe, expect, it } from "vitest";
import { formatOccurrence, nextOccurrences, validateSlots, zonedToUtc } from "./availability-rules";

describe("disponibilités des coachs", () => {
  it("convertit une heure locale en instant UTC (heure d'été et d'hiver)", () => {
    expect(zonedToUtc("2026-10-05", "21:00", "Europe/Paris").toISOString()).toBe("2026-10-05T19:00:00.000Z");
    expect(zonedToUtc("2026-12-07", "21:00", "Europe/Paris").toISOString()).toBe("2026-12-07T20:00:00.000Z");
    expect(zonedToUtc("2026-10-05", "21:00", "Africa/Abidjan").toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });

  it("refuse les créneaux incohérents", () => {
    expect(validateSlots([{ weekday: 0, start: "21:00", end: "23:00" }])).toBeNull();
    expect(validateSlots([{ weekday: 0, start: "23:00", end: "21:00" }])).toContain("après");
    expect(validateSlots([{ weekday: 1, start: "19:00", end: "21:00" }, { weekday: 1, start: "20:00", end: "22:00" }])).toContain("chevauchent");
    expect(validateSlots([{ weekday: 7, start: "19:00", end: "21:00" }])).toBe("Jour invalide.");
  });

  it("donne les prochains créneaux, affichés dans le fuseau de l'élève", () => {
    // Dimanche 4 octobre 2026, 20 h à Paris : le coach remplit sa semaine.
    const now = new Date("2026-10-04T18:00:00Z");
    const occ = nextOccurrences([{ weekday: 1, start: "19:00", end: "22:00" }, { weekday: 0, start: "21:00", end: "23:00" }], "Europe/Paris", now);
    expect(occ.map((o) => formatOccurrence(o, "Europe/Paris"))).toEqual(["Lundi 21:00–23:00", "Mardi 19:00–22:00"]);
    expect(formatOccurrence(occ[0], "Africa/Abidjan")).toBe("Lundi 19:00–21:00");
  });
});
