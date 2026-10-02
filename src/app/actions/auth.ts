"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { createSession, destroySession } from "@/server/auth/session";

// Connexion de démonstration (désactivée en production). La vraie connexion passera par Discord.
export async function devLogin(formData: FormData) {
  if (!getEnv().devLoginEnabled) redirect("/login");
  const as = String(formData.get("as"));
  const user = await prisma.user.findFirst({
    where: as === "coach" ? { role: "ADMIN" } : as === "coaching" ? { role: "LEARNER", coachingStatus: "ACTIVE" } : { role: "LEARNER", coachingStatus: "NONE" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) redirect("/login?erreur=demo");
  await createSession(user.id);
  await prisma.auditLog.create({ data: { actorUserId: user.id, action: "USER_LOGIN", metadata: { method: "dev" } } });
  redirect(as === "coaching" ? "/coaching" : "/learn");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
