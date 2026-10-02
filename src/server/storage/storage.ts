import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, rename } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getEnv } from "@/server/env";

// Stockage des fichiers sur le disque du serveur. Seul ce module touche aux octets.
// Les clés sont générées par le serveur (jamais par l'utilisateur).

export class FileTooLargeError extends Error {}

function root() {
  return path.resolve(getEnv().STORAGE_DIR);
}

export function filePath(key: string) {
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("clé de stockage invalide");
  return full;
}

// Écrit un flux en vérifiant la taille au fil de l'eau ; calcule le SHA-256.
export async function writeStream(key: string, input: Readable, maxBytes: number) {
  const dest = filePath(key);
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  const hash = createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > maxBytes) return cb(new FileTooLargeError());
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(input, meter, createWriteStream(tmp));
    await rename(tmp, dest);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
  return { sizeBytes: size, sha256: hash.digest("hex") };
}

export async function deleteFile(key: string) {
  await rm(filePath(key), { force: true });
}

export async function exists(key: string) {
  try {
    await stat(filePath(key));
    return true;
  } catch {
    return false;
  }
}

export function readStream(key: string) {
  return createReadStream(filePath(key));
}
