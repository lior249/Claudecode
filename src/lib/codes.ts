import { randomInt } from "node:crypto";

// Sans caractères ambigus (0/O, 1/I/L) : le code est recopié depuis une vidéo.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateValidationCode(length = 10) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
