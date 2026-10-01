"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";
import { createSession, destroySession } from "@/server/auth/session";
import { assignCoachIfNeeded } from "@/server/coaching/assign";

// Connexion de démonstration (désactivée en production). La vraie connexion passera par Discord.
export async function devLogin(formData: FormData) {
  if (!getEnv().devLoginEnabled) redirect("/login");
  const as = formData.get("as") === "coach" ? "coach" : "learner";
  const user = await prisma.user.findFirst({
    where: as === "coach" ? { role: "ADMIN" } : { role: "LEARNER" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) redirect("/login?erreur=demo");
  await assignCoachIfNeeded(user.id);
  await createSession(user.id);
  await prisma.auditLog.create({ data: { actorUserId: user.id, action: "USER_LOGIN", metadata: { method: "dev" } } });
  redirect("/learn");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
