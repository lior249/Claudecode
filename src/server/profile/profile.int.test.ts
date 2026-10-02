import { beforeEach, describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { exists } from "@/server/storage/storage";
import { resetDb } from "../../../tests/db";
import { avatarOf, memberCard, resetProfilePhoto, setProfilePhoto, viewsFor } from "./service";


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

  it("fiche d'un membre : seuls les résultats validés, meilleur mois à 0 € sinon", async () => {
    const u = await prisma.user.create({ data: { displayName: "Max", coachingStatus: "ACTIVE", coachingStartedAt: new Date("2026-08-01"), timezone: "Europe/Paris" } });
    expect((await memberCard(u.id)).bestMonthEur).toBe(0);
    for (const [month, amountEur, status] of [["2026-08", 150, "APPROVED"], ["2026-09", 620, "APPROVED"], ["2026-10", 5000, "PENDING"]] as const) {
      await prisma.rankProof.create({ data: { learnerId: u.id, kind: "MONTHLY", month, amountEur, imageKey: "x", status } });
    }
    const card = await memberCard(u.id);
    expect(card.bestMonthEur).toBe(620);
    expect(card.months).toEqual([
      { month: "2026-09", amountEur: 620 },
      { month: "2026-08", amountEur: 150 },
    ]);
  });
});
