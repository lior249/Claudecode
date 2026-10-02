// Évaluation des mesures automatiques (pure). Entrée : mesures ffmpeg + texte ; sortie : critères notés.
import type { PracticeCheck } from "./config";
import type { CriterionResult } from "./scoring";
import { firstSentence, normalizeWords, textSimilarity } from "./text";

export interface Measurements {
  durationSeconds?: number;
  hasAudio?: boolean;
  cuts?: number[]; // instants des changements de plan (s)
  silences?: { start: number; end: number; duration: number }[];
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const s = (n: number) => (n > 1 ? "s" : "");

export function evaluateCheck(check: PracticeCheck, m: Measurements, text: string | null): CriterionResult {
  const base = { name: check.label, source: "MEASURE" as const };
  switch (check.type) {
    case "noAudio": {
      const ok = m.hasAudio === false;
      return { ...base, maxPoints: check.penalty, pointsLost: ok ? 0 : check.penalty, comment: ok ? "Aucun son : parfait." : "Ta vidéo contient une piste audio. Exporte-la sans le son." };
    }
    case "cuts": {
      const found = m.cuts ?? [];
      const used = new Set<number>();
      const missed: number[] = [];
      for (const t of check.expected) {
        const idx = found.findIndex((c, i) => !used.has(i) && Math.abs(c - t) <= check.tolerance);
        if (idx === -1) missed.push(t);
        else used.add(idx);
      }
      const extra = found.filter((_, i) => !used.has(i));
      const max = check.expected.length * check.penaltyPerMiss;
      const lost = Math.min(max, missed.length * check.penaltyPerMiss);
      const parts = [`${check.expected.length - missed.length}/${check.expected.length} cuts au bon moment.`];
      if (missed.length) parts.push(`Manquant${s(missed.length)} ou mal placé${s(missed.length)} : ${missed.map((t) => `${fmt(t)} s`).join(", ")} (± ${fmt(check.tolerance)} s).`);
      if (extra.length) parts.push(`Cut${s(extra.length)} en trop : ${extra.map((t) => `${fmt(t)} s`).join(", ")}.`);
      return { ...base, maxPoints: max, pointsLost: lost, comment: parts.join(" ") };
    }
    case "silences": {
      const long = (m.silences ?? []).filter((x) => x.duration >= check.minSilence);
      const lost = Math.min(check.maxPenalty, long.length * check.penaltyPerSilence);
      return {
        ...base,
        maxPoints: check.maxPenalty,
        pointsLost: lost,
        comment: long.length
          ? `${long.length} silence${s(long.length)} de ${fmt(check.minSilence)} s ou plus : ${long.map((x) => `à ${fmt(x.start)} s (${fmt(x.duration)} s)`).join(", ")}.`
          : "Aucun silence trop long.",
      };
    }
    case "duration": {
      const d = m.durationSeconds ?? 0;
      const ok = Math.abs(d - check.target) <= check.tolerance;
      return { ...base, maxPoints: check.penalty, pointsLost: ok ? 0 : check.penalty, comment: `Durée : ${fmt(d)} s (attendu : ${fmt(check.target)} s ± ${fmt(check.tolerance)} s).` };
    }
    case "maxShotLength": {
      const bounds = [0, ...(m.cuts ?? []), m.durationSeconds ?? 0];
      const tooLong: { start: number; length: number }[] = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const length = bounds[i + 1] - bounds[i];
        if (length > check.max + 0.1) tooLong.push({ start: bounds[i], length });
      }
      const lost = Math.min(check.maxPenalty, tooLong.length * check.penaltyPerShot);
      return {
        ...base,
        maxPoints: check.maxPenalty,
        pointsLost: lost,
        comment: tooLong.length
          ? `${tooLong.length} plan${s(tooLong.length)} trop long${s(tooLong.length)} : ${tooLong.map((x) => `à ${fmt(x.start)} s (${fmt(x.length)} s)`).join(", ")}.`
          : `Tous les plans durent ${fmt(check.max)} s maximum.`,
      };
    }
    case "textSimilarity": {
      const ratio = textSimilarity(text ?? "", check.reference);
      const ok = ratio >= check.min;
      return { ...base, maxPoints: check.penalty, pointsLost: ok ? 0 : check.penalty, comment: `Ressemblance avec le script : ${Math.floor(ratio * 100)} % (minimum ${Math.round(check.min * 100)} %).` };
    }
    case "hookUnchanged": {
      const ok = normalizeWords(firstSentence(text ?? "")).join(" ") === normalizeWords(check.hook).join(" ");
      return { ...base, maxPoints: check.penalty, pointsLost: ok ? 0 : check.penalty, comment: ok ? "Le hook n'a pas été modifié." : "Le hook (la première phrase) a été modifié : il doit rester identique." };
    }
    case "shorterThan": {
      const mine = normalizeWords(text ?? "").length;
      const ref = normalizeWords(check.reference).length;
      const ok = mine > 0 && mine < ref;
      return { ...base, maxPoints: check.penalty, pointsLost: ok ? 0 : check.penalty, comment: `${mine} mots (l'original en compte ${ref}).` };
    }
  }
}
