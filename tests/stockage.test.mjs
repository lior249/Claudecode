import { test } from "node:test";
import assert from "node:assert/strict";
import { stockageLocal } from "./aide-stockage.mjs";

const nouveau = stockageLocal();

test("écrit, lit, liste par préfixe et efface", async () => {
  const s = nouveau();
  assert.equal(await s.get("sessions/a", { type: "json" }), null);
  await s.setJSON("sessions/a", { x: 1 });
  await s.setJSON("sessions/b", { x: 2 });
  await s.set("webhooks/2026-10-12T08-30-00-000Z", "{}");
  assert.deepEqual(await s.get("sessions/a", { type: "json" }), { x: 1 });
  assert.deepEqual((await s.list({ prefix: "sessions/" })).blobs.map((b) => b.key), ["sessions/a", "sessions/b"]);
  assert.deepEqual((await s.list({ prefix: "rien/" })).blobs, []);
  await s.delete("sessions/a");
  await s.delete("sessions/a");
  assert.deepEqual((await s.list({ prefix: "sessions/" })).blobs.map((b) => b.key), ["sessions/b"]);
});

test("écritures conditionnelles : onlyIfNew et onlyIfMatch", async () => {
  const s = nouveau();
  assert.deepEqual(await s.set("k", "1", { onlyIfNew: true }), { modified: true });
  assert.deepEqual(await s.set("k", "2", { onlyIfNew: true }), { modified: false });
  const { etag } = await s.getWithMetadata("k");
  assert.deepEqual(await s.set("k", "3", { onlyIfMatch: etag }), { modified: true });
  assert.deepEqual(await s.set("k", "4", { onlyIfMatch: etag }), { modified: false });
  assert.equal(await s.get("k"), "3");
  assert.deepEqual(await s.set("absent", "x", { onlyIfMatch: etag }), { modified: false });
});

test("refuse les clés qui sortiraient du dossier", async () => {
  const s = nouveau();
  for (const k of ["../x", "a/../../x", "/etc/passwd", "a//b", "", "a b"]) {
    await assert.rejects(() => s.set(k, "x"), /clé invalide/, k);
  }
});
