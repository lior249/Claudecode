import "server-only";
import { prisma } from "@/server/db";
import { deleteFile } from "@/server/storage/storage";

// Seul module qui supprime des fichiers. Supprimer un fichier ≠ supprimer une soumission :
// la ligne Asset (hash, taille, durée) et la soumission (note, retour) restent en base.

export const KEEP_LAST_SUBMISSIONS = 5;

async function deleteAssetFiles(assets: { id: string; storageKey: string }[], reason: string) {
  for (const a of assets) {
    await deleteFile(a.storageKey);
    await prisma.asset.update({ where: { id: a.id }, data: { deletedAt: new Date() } });
  }
  if (assets.length) {
    await prisma.auditLog.create({ data: { action: "ASSET_DELETED", entityType: "asset", metadata: { reason, count: assets.length } } });
  }
}

// Ne garde physiquement que les fichiers des 5 dernières soumissions d'un exercice.
export async function pruneOldSubmissionFiles(userId: string, lessonId: string) {
  const old = await prisma.submission.findMany({
    where: { userId, lessonId },
    orderBy: { attemptNumber: "desc" },
    skip: KEEP_LAST_SUBMISSIONS,
    select: { assets: { where: { deletedAt: null }, select: { id: true, storageKey: true } } },
  });
  await deleteAssetFiles(old.flatMap((s) => s.assets), "keep_last_5");
}

// Fichiers envoyés mais jamais soumis (élève parti en cours de route).
export async function cleanupOrphanAssets(olderThanMs = 24 * 60 * 60 * 1000) {
  const orphans = await prisma.asset.findMany({
    where: { submissionId: null, deletedAt: null, createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    select: { id: true, storageKey: true },
  });
  await deleteAssetFiles(orphans, "orphan");
  return orphans.length;
}
