import "server-only";
import { randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { deleteFile, filePath, FileTooLargeError, writeStream } from "./storage";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export class ImageError extends Error {}

// Type réel d'après les premiers octets (on ne fait pas confiance à l'extension).
export function sniffImage(head: Buffer): { ext: string; mime: string } | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (head.length >= 12 && head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Enregistre une image du catalogue (JPG, PNG ou WebP, 10 Mo maximum).
export const storeCatalogImage = (body: Readable) => storeImage("catalog", body);

// Image privée d'un utilisateur (tickets, preuves) : uploads/<propriétaire>/<id>.<ext>.
export const storeUserImage = (ownerId: string, body: Readable) => storeImage(`uploads/${ownerId}`, body);

export const USER_IMAGE_KEY = /^uploads\/([a-z0-9]{20,40})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

async function storeImage(prefix: string, body: Readable) {
  const id = randomUUID();
  const tmpKey = `${prefix}/${id}.upload`;
  try {
    await writeStream(tmpKey, body, MAX_IMAGE_BYTES);
  } catch (e) {
    await deleteFile(tmpKey);
    if (e instanceof FileTooLargeError) throw new ImageError("Image trop lourde : 10 Mo maximum.");
    throw e;
  }
  const fh = await open(filePath(tmpKey), "r");
  const head = Buffer.alloc(16);
  await fh.read(head, 0, 16, 0);
  await fh.close();
  const type = sniffImage(head);
  if (!type) {
    await deleteFile(tmpKey);
    throw new ImageError("Format d'image non accepté (JPG, PNG ou WebP).");
  }
  const key = `${prefix}/${id}.${type.ext}`;
  const { rename } = await import("node:fs/promises");
  await rename(filePath(tmpKey), filePath(key));
  return key;
}
