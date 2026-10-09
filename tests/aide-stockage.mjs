// Stockage sur disque dans un dossier temporaire, effacé à la fin des tests.
import { after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ouvrirStockage } from "../lib/stockage.mjs";

export function stockageLocal() {
  const dir = mkdtempSync(join(tmpdir(), "creato-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  let n = 0;
  return () => ouvrirStockage(join(dir, `test-${n++}`));
}
