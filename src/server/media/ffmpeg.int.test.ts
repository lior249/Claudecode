import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectCuts, detectSilences, probe } from "./ffmpeg";

const fx = (f: string) => path.resolve(import.meta.dirname, "../../../tests/fixtures", f);

describe("analyse ffmpeg (vrais fichiers)", () => {
  it("détecte les cuts d'une vidéo", async () => {
    expect(await detectCuts(fx("cuts-ok.mp4"))).toEqual([3, 5, 8, 13]);
    const p = await probe(fx("cuts-ok.mp4"));
    expect(p).toMatchObject({ hasVideo: true, hasAudio: false });
    expect(p.durationSeconds).toBeCloseTo(15, 0);
  });
  it("vidéo ratée : cuts décalés et piste audio présente", async () => {
    expect(await detectCuts(fx("cuts-ko.mp4"))).toEqual([3, 6.5, 8, 14]);
    expect((await probe(fx("cuts-ko.mp4"))).hasAudio).toBe(true);
  });
  it("détecte les silences d'une voix off", async () => {
    expect(await detectSilences(fx("voix-ok.mp3"))).toEqual([]);
    const ko = await detectSilences(fx("voix-ko.mp3"));
    expect(ko.map((s) => Math.round(s.duration * 10) / 10)).toEqual([0.8, 1.2]);
    expect((await probe(fx("voix-ko.mp3"))).hasVideo).toBe(false);
  });
});
