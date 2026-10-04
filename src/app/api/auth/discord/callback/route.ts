import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { createSession } from "@/server/auth/session";
import { loginWithDiscord } from "@/server/auth/discord-login";
import { OAUTH_COOKIE, readOAuthCookie } from "@/server/auth/oauth-state";

export async function GET(request: NextRequest) {
  if (!getEnv().discordLoginEnabled) redirect("/login?erreur=DISCORD");
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const oauth = readOAuthCookie(store.get(OAUTH_COOKIE)?.value, params.get("state"));
  store.delete({ name: OAUTH_COOKIE, path: "/api/auth/discord" });

  if (params.get("error")) redirect("/login?erreur=DENIED");
  const code = params.get("code");
  if (!oauth || !code) redirect("/login?erreur=STATE");

  let result;
  try {
    result = await loginWithDiscord(code, oauth.verifier);
  } catch (e) {
    console.error("[discord-login]", e);
    redirect("/login?erreur=DISCORD");
  }
  if (!result.ok) redirect(`/login?erreur=${result.error}`);

  await createSession(result.userId);
  redirect("/"); // la page d'accueil oriente (accueil en 4 étapes à la première connexion)
}
