import "server-only";
import { getEnv } from "@/server/env";

// Protection CSRF des routes API (les server actions ont déjà leur propre contrôle d'origine).
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new URL(getEnv().APP_URL).origin;
  const host = request.headers.get("host");
  return origin === allowed || (host !== null && new URL(origin).host === host);
}
