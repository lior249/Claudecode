// Vrai stockage Netlify Blobs lancé en local pour les tests.
import { after, before } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { BlobsServer } from "@netlify/blobs/server";

export function stockageLocal() {
  let server, dir, port, n = 0;
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "blobs-"));
    server = new BlobsServer({ directory: dir, token: "jeton" });
    ({ port } = await server.start());
  });
  after(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });
  return () => {
    const url = `http://localhost:${port}`;
    return getStore({ name: `test-${n++}`, siteID: "site", token: "jeton", edgeURL: url, uncachedEdgeURL: url, consistency: "strong" });
  };
}
