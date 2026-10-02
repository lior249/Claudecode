import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// État OAuth (anti-CSRF) + PKCE, conservés 10 minutes dans un cookie HttpOnly.
export const OAUTH_COOKIE = "creato_oauth";
export const OAUTH_MAX_AGE = 10 * 60;

export function newOAuthState() {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge, cookie: `${state}.${verifier}` };
}

export function readOAuthCookie(cookie: string | undefined, returnedState: string | null) {
  if (!cookie || !returnedState) return null;
  const [state, verifier] = cookie.split(".");
  if (!state || !verifier) return null;
  const a = Buffer.from(state);
  const b = Buffer.from(returnedState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { verifier };
}
