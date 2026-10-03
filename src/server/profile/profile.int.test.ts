import { beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { exists } from "@/server/storage/storage";
import { resetDb } from "../../../tests/db";
import { avatarOf, memberCard, previousMonth, resetProfilePhoto, setProfilePhoto, viewsFor } from "./service";
import { isPublicProofImage } from "@/server/coaching/access";


beforeEach(resetDb);

describe("Profil", () => {
  it("vues proposées selon le rôle", () => {
    expect(viewsFor({ role: "LEARNER", coachingStatus: "NONE" }).map((v) => v.label)).toEqual(["Élève"]);
    expect(viewsFor({ role: "LEARNER", coachingStatus: "ACTIVE" })[0].href).toBe("/coaching");
    expect(viewsFor({ role: "COACH", coachingStatus: "NONE" }).map((v) => v.label)).toEqual(["Élève", "Coach"]);
    expect(viewsFor({ role: "ADMIN", coachingStatus: "NONE" }).map((v) => v.label)).toEqual(["Élève", "Coach", "Admin"]);
  });

  it("photo Creato à la place de Discord, l'ancienne est supprimée", async () => {
    const u = await prisma.user.create({ data: { displayName: "Léa", avatarUrl: "https://cdn.discordapp.com/a.png" } });
    expect(avatarOf(u)).toBe("https://cdn.discordapp.com/a.png");
    const img = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    await setProfilePhoto(u.id, Readable.from([img]));
    const first = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).photoKey!;
    expect(first).toMatch(/^avatars\//);
    await setProfilePhoto(u.id, Readable.from([img]));
    expect(await exists(first)).toBe(false);
    await resetProfilePhoto(u.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.photoKey).toBeNull();
    expect(avatarOf(after)).toBe("https://cdn.discordapp.com/a.png");
  });

  it("fiche d'un membre : mois dernier, meilleur mois, total ; seuls les résultats validés, captures visibles par tous", async () => {
    const now = new Date("2026-10-15T12:00:00Z");
    const u = await prisma.user.create({ data: { displayName: "Max", coachingStatus: "ACTIVE", coachingStartedAt: new Date("2026-08-01"), timezone: "Europe/Paris" } });
    expect(await memberCard(u.id, now)).toMatchObject({ lastMonthEur: 0, bestMonthEur: 0, totalEur: 0, months: [] });
    const img = (n: number) => `uploads/${u.id}/0000000${n}-0000-4000-8000-000000000000.png`;
    for (const [n, month, amountEur, status] of [[1, "2026-08", 150, "APPROVED"], [2, "2026-09", 620, "APPROVED"], [3, "2026-10", 5000, "PENDING"]] as const) {
      await prisma.rankProof.create({ data: { learnerId: u.id, kind: "MONTHLY", month, amountEur, imageKey: img(n), status } });
    }
    const card = await memberCard(u.id, now);
    expect(card).toMatchObject({ lastMonthEur: 620, bestMonthEur: 620, totalEur: 770 });
    expect(card.months.map((m) => [m.month, m.amountEur])).toEqual([["2026-09", 620], ["2026-08", 150]]);
    expect(card.months[0].imageUrl).toContain(img(2));
    expect(await isPublicProofImage(img(2))).toBe(true);
    expect(await isPublicProofImage(img(3))).toBe(false); // en attente : reste privée
  });

  it("mois précédent", () => {
    expect(previousMonth("2026-10-15")).toBe("2026-09");
    expect(previousMonth("2026-01-03")).toBe("2025-12");
  });
});
