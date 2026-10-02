import { getEnv } from "@/server/env";
import { GeminiProvider } from "./gemini";
import { MockAIProvider } from "./mock";
import type { AIProvider } from "./types";

let override: AIProvider | null = null;

// Pour les tests : remplacer le correcteur.
export function setAIProviderForTests(provider: AIProvider | null) {
  override = provider;
}

export function getAIProvider(): AIProvider {
  if (override) return override;
  const env = getEnv();
  if (env.AI_PROVIDER === "gemini") return new GeminiProvider(env.GEMINI_API_KEY!, env.GEMINI_MODEL);
  return new MockAIProvider();
}
