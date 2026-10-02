import { describe, expect, it } from "vitest";
import { isLaunchKeyValid, parseLaunchConfig } from "./rules";
import { catalogOfLesson } from "@/server/decisions/catalog";
import { sniffImage } from "@/server/storage/images";

const config = parseLaunchConfig({ phrase: "J'ai validé le module à 100 %", code: "7TQ3F3MN7B" });

describe("phrase + code du lancement", () => {
  it("tolère majuscules, accents, apostrophes, espaces et point final", () => {
    expect(isLaunchKeyValid(config, "j’ai VALIDE le module a 100%.", "7tq3 f3mn-7b")).toBe(true);
  });
  it("refuse une phrase ou un code faux, et un code vide côté config", () => {
    expect(isLaunchKeyValid(config, "J'ai fini", "7TQ3F3MN7B")).toBe(false);
    expect(isLaunchKeyValid(config, "J'ai validé le module à 100 %", "7TQ3F3MN7C")).toBe(false);
    expect(isLaunchKeyValid(parseLaunchConfig({ code: "" }), "J'ai validé le module à 100 %", "")).toBe(false);
  });
  it("10 questions de ressenti par défaut", () => {
    expect(parseLaunchConfig({}).questions).toHaveLength(10);
  });
});

describe("catalogues et images", () => {
  it("retrouve le catalogue d'une leçon", () => {
    expect(catalogOfLesson({ catalog: "niches" })).toBe("NICHE");
    expect(catalogOfLesson({ catalog: "methods10k" })).toBe("METHOD_10K");
    expect(catalogOfLesson({})).toBeNull();
  });
  it("reconnaît une image par ses premiers octets, pas par son nom", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(sniffImage(Buffer.from("RIFF0000WEBPVP8 "))?.ext).toBe("webp");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});
