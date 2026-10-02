import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/server/env";
import { authorizeUrl } from "@/server/discord/api";
import { newOAuthState, OAUTH_COOKIE, OAUTH_MAX_AGE } from "@/server/auth/oauth-state";

export async function GET() {
  if (!getEnv().discordLoginEnabled) redirect("/login?erreur=DISCORD");
  const { state, challenge, cookie } = newOAuthState();
  (await cookies()).set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/discord",
    maxAge: OAUTH_MAX_AGE,
  });
  redirect(authorizeUrl(state, challenge));
}
