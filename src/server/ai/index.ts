import { getEnv } from "@/server/env";
import { ClaudeScreenshotReader, MockScreenshotReader, type ScreenshotReader } from "./screenshot";

// Le fournisseur se choisit par configuration : « claude » en production, IA simulée en développement.
let screenshotOverride: ScreenshotReader | null = null;
export function setScreenshotReaderForTests(r: ScreenshotReader | null) {
  screenshotOverride = r;
}

/** Lecteur des captures de résultats. */
export function getScreenshotReader(): ScreenshotReader {
  if (screenshotOverride) return screenshotOverride;
  const env = getEnv();
  if (env.AI_PROVIDER === "claude") return new ClaudeScreenshotReader(env.ANTHROPIC_API_KEY!, env.CLAUDE_MODEL);
  return new MockScreenshotReader();
}
