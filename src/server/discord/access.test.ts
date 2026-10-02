import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";
import { newOAuthState, readOAuthCookie } from "@/server/auth/oauth-state";

const base = { discordUserId: "42", tiktokRoleId: "TIKTOK", adminDiscordIds: ["7"] };

describe("decideAccess", () => {
  it("accepte un membre avec le rôle @TikTok", () => {
    expect(decideAccess({ ...base, memberRoles: ["X", "TIKTOK"] })).toEqual({ allowed: true, role: "LEARNER" });
  });
  it("refuse un membre sans le rôle", () => {
    expect(decideAccess({ ...base, memberRoles: ["X"] })).toEqual({ allowed: false, reason: "MISSING_ROLE" });
  });
  it("refuse quelqu'un qui n'est pas sur le serveur", () => {
    expect(decideAccess({ ...base, memberRoles: null })).toEqual({ allowed: false, reason: "NOT_MEMBER" });
  });
  it("laisse toujours entrer un administrateur déclaré", () => {
    expect(decideAccess({ ...base, discordUserId: "7", memberRoles: null })).toEqual({ allowed: true, role: "ADMIN" });
  });
});

describe("état OAuth", () => {
  it("accepte uniquement l'état émis", () => {
    const s = newOAuthState();
    expect(readOAuthCookie(s.cookie, s.state)).toEqual({ verifier: s.verifier });
    expect(readOAuthCookie(s.cookie, "autre")).toBeNull();
    expect(readOAuthCookie(undefined, s.state)).toBeNull();
    expect(readOAuthCookie("abc", "abc")).toBeNull();
  });
});
