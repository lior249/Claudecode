// Mesures exactes (pures) ajoutées au rapport d'analyse : texte comparé à la référence.
import { firstSentence, normalizeWords, textSimilarity } from "./text";

export interface MediaMeasurements {
  durationSeconds: number;
  hasAudio: boolean;
  hasVideo: boolean;
  cuts: number[]; // instants des changements de plan (s), précision ~0,03 s
  shots: { start: number; end: number; duration: number }[];
  silences: { start: number; end: number; duration: number }[]; // silences de 0,25 s ou plus
}

export interface TextMeasurements {
  wordCount: number;
  reference?: {
    wordCount: number;
    similarityPercent: number; // ressemblance mot à mot, exacte
    firstSentenceIdentical: boolean;
    referenceFirstSentence: string;
    submittedFirstSentence: string;
  };
}

export function shotsFromCuts(cuts: number[], duration: number) {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < duration), duration];
  return bounds.slice(0, -1).map((start, i) => {
    const end = bounds[i + 1];
    return { start, end, duration: Math.round((end - start) * 100) / 100 };
  });
}

export function measureText(text: string, referenceText: string): TextMeasurements {
  const words = normalizeWords(text).length;
  if (!referenceText.trim()) return { wordCount: words };
  const refFirst = firstSentence(referenceText);
  const mine = firstSentence(text);
  return {
    wordCount: words,
    reference: {
      wordCount: normalizeWords(referenceText).length,
      similarityPercent: Math.floor(textSimilarity(text, referenceText) * 1000) / 10,
      firstSentenceIdentical: normalizeWords(mine).join(" ") === normalizeWords(refFirst).join(" "),
      referenceFirstSentence: refFirst,
      submittedFirstSentence: mine,
    },
  };
}
