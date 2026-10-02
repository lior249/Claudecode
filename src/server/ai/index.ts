import { getEnv } from "@/server/env";
import { GeminiAnalyst, GeminiClient, GeminiGrader } from "./gemini";
import { MockAnalyst, MockGrader } from "./mock";
import type { Analyst, Grader } from "./types";

// Le fournisseur se choisit par configuration : on peut changer d'IA sans toucher au reste du code.
let overrides: { analyst?: Analyst | null; grader?: Grader | null } = {};

export function setAIForTests(o: { analyst?: Analyst | null; grader?: Grader | null }) {
  overrides = o;
}

export function getAnalyst(): Analyst {
  if (overrides.analyst) return overrides.analyst;
  const env = getEnv();
  if (env.AI_PROVIDER === "gemini") return new GeminiAnalyst(new GeminiClient(env.GEMINI_API_KEY!), env.GEMINI_ANALYST_MODEL, env.GEMINI_VIDEO_FPS);
  return new MockAnalyst();
}

export function getGrader(): Grader {
  if (overrides.grader) return overrides.grader;
  const env = getEnv();
  if (env.AI_PROVIDER === "gemini") return new GeminiGrader(new GeminiClient(env.GEMINI_API_KEY!), env.GEMINI_GRADER_MODEL);
  return new MockGrader();
}
