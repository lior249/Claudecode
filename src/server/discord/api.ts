import "server-only";
import { getEnv } from "@/server/env";

// Client Discord minimal (API REST v10). Aucune autre partie du code n'appelle Discord directement.
const api = () => `${getEnv().DISCORD_API_BASE}/api/v10`;

export class DiscordError extends Error {}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}
export interface DiscordMember {
  nick: string | null;
  roles: string[];
  avatar: string | null;
}

export function redirectUri() {
  return `${getEnv().APP_URL}/api/auth/discord/callback`;
}

export function authorizeUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: getEnv().DISCORD_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: "identify guilds.members.read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "none",
  });
  return `${getEnv().DISCORD_API_BASE}/oauth2/authorize?${params}`;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const env = getEnv();
  const res = await fetch(`${api()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID!,
      client_secret: env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new DiscordError(`token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${api()}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!res.ok) throw new DiscordError(`users/@me failed: ${res.status}`);
  return res.json();
}

// null si l'utilisateur n'est pas membre du serveur.
export async function fetchOwnGuildMember(accessToken: string): Promise<DiscordMember | null> {
  const res = await fetch(`${api()}/users/@me/guilds/${getEnv().DISCORD_GUILD_ID}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new DiscordError(`guild member failed: ${res.status}`);
  return res.json();
}

// --- Appels du bot (nécessitent DISCORD_BOT_TOKEN) ---

function botHeaders() {
  const token = getEnv().DISCORD_BOT_TOKEN;
  if (!token) throw new DiscordError("DISCORD_BOT_TOKEN manquant");
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

export function botConfigured() {
  return Boolean(getEnv().DISCORD_BOT_TOKEN && getEnv().DISCORD_GUILD_ID);
}

// Rôles actuels d'un membre, vus par le bot. null si le membre a quitté le serveur.
export async function botFetchMemberRoles(discordUserId: string): Promise<string[] | null> {
  const res = await fetch(`${api()}/guilds/${getEnv().DISCORD_GUILD_ID}/members/${discordUserId}`, {
    headers: botHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new DiscordError(`bot member fetch failed: ${res.status}`);
  return ((await res.json()) as DiscordMember).roles;
}

export async function botAddRole(discordUserId: string, roleId: string) {
  const res = await fetch(`${api()}/guilds/${getEnv().DISCORD_GUILD_ID}/members/${discordUserId}/roles/${roleId}`, {
    method: "PUT",
    headers: { ...botHeaders(), "X-Audit-Log-Reason": "Creato : parcours Learn terminé" },
  });
  if (!res.ok) throw new DiscordError(`add role failed: ${res.status} ${await res.text()}`);
}

export async function botSendDirectMessage(discordUserId: string, content: string) {
  const dm = await fetch(`${api()}/users/@me/channels`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dm.ok) throw new DiscordError(`open DM failed: ${dm.status}`);
  const { id } = (await dm.json()) as { id: string };
  const res = await fetch(`${api()}/channels/${id}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) throw new DiscordError(`send DM failed: ${res.status}`);
}

export function avatarUrl(user: DiscordUser) {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;
}
