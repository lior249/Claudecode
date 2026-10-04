import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { exists } from "@/server/storage/storage";
import { resetDb } from "../../../tests/db";
import { completeOnboarding, getOnboardingVideo, needsOnboarding, removeOnboardingVideo, setOnboardingVideo } from "./service";

const fx = (f: string) => path.resolve(import.meta.dirname, "../../../tests/fixtures", f);

describe("Accueil : première connexion et vidéo de l'admin", () => {
  beforeEach(resetDb);

  it("un nouveau membre passe par l'accueil une seule fois", async () => {
    const u = await prisma.user.create({ data: { displayName: "Nouveau", role: "LEARNER" } });
    expect(needsOnboarding(u)).toBe(true);
    const first = new Date("2026-10-04T10:00:00Z");
    await completeOnboarding(u.id, first);
    await completeOnboarding(u.id, new Date("2026-10-05T10:00:00Z")); // sans effet : la date reste la première
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.onboardedAt).toEqual(first);
    expect(needsOnboarding(after)).toBe(false);
  });

  it("vidéo : remplacée (l'ancienne est supprimée), formats et faux fichiers refusés, puis retirée", async () => {
    const admin = await prisma.user.create({ data: { displayName: "Admin", role: "ADMIN" } });
    expect(await getOnboardingVideo()).toBeNull();
    await expect(setOnboardingVideo(admin.id, "voix.mp3", createReadStream(fx("voix-ok.mp3")))).rejects.toThrow("MP4, MOV ou WebM");
    await expect(setOnboardingVideo(admin.id, "faux.mp4", Readable.from([Buffer.from("pas une vidéo")]))).rejects.toThrow("illisible");

    const v1 = await setOnboardingVideo(admin.id, "bienvenue.mp4", createReadStream(fx("cuts-ok.mp4")));
    expect(v1).toMatchObject({ name: "bienvenue.mp4", mime: "video/mp4" });
    const v2 = await setOnboardingVideo(admin.id, "bienvenue-v2.mp4", createReadStream(fx("cuts-ko.mp4")));
    expect(await getOnboardingVideo()).toEqual(v2);
    expect(await exists(v1.key)).toBe(false);
    expect(await exists(v2.key)).toBe(true);

    await removeOnboardingVideo(admin.id);
    expect(await getOnboardingVideo()).toBeNull();
    expect(await exists(v2.key)).toBe(false);
  });
});
