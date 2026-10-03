import "server-only";
import { prisma } from "@/server/db";

// Qui peut voir les données d'un élève en coaching : lui-même, son coach, les admins.
export async function canSeeLearner(viewer: { id: string; role: string }, learnerId: string) {
  if (viewer.role === "ADMIN" || viewer.id === learnerId) return true;
  const learner = await prisma.user.findUnique({ where: { id: learnerId }, select: { coachId: true } });
  return learner?.coachId === viewer.id;
}

// Capture de résultats du mois validée : visible par tous les membres (fiche du classement).
export async function isPublicProofImage(key: string) {
  return Boolean(await prisma.rankProof.findFirst({ where: { imageKey: key, kind: "MONTHLY", status: "APPROVED" }, select: { id: true } }));
}

// Image privée : propriétaire, admins, et les personnes en relation coach ↔ élève avec lui.
export async function canSeeUpload(viewer: { id: string; role: string }, ownerId: string) {
  if (viewer.role === "ADMIN" || viewer.id === ownerId) return true;
  const [owner, me] = [
    await prisma.user.findUnique({ where: { id: ownerId }, select: { coachId: true } }),
    await prisma.user.findUnique({ where: { id: viewer.id }, select: { coachId: true } }),
  ];
  return owner?.coachId === viewer.id || me?.coachId === ownerId;
}
