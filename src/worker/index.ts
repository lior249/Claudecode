// Worker : traite la file de tâches (analyse des soumissions), les relances, les messages privés et le ménage périodique.
// Lancement : npm run worker (un processus séparé du site, avec ffmpeg installé).
import "dotenv/config";
import { claimNextJob, completeJob, failJob, releaseStuckJobs } from "@/server/jobs/queue";
import { processSubmission } from "@/server/practice/service";
import { processResultRead } from "@/server/results/service";
import { cleanupOrphanAssets } from "@/server/retention/service";
import { grantEliteRole } from "@/server/launch/service";
import { sendDeadlineReminders } from "@/server/reminders/service";
import { processOutcomeReminders, processResponseWaits } from "@/server/coaching/tickets";
import { processAbsences } from "@/server/coaching/lifecycle";
import { deliverPendingDms, pruneNotifications } from "@/server/notifications/service";
import { runEngagement } from "@/server/notifications/engagement";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";

const IDLE_MS = 1500;
const HOUSEKEEPING_MS = 10 * 60 * 1000;
const REMINDERS_MS = 5 * 60 * 1000;
const DMS_MS = 60 * 1000;
let stopping = false;

async function handle(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "submission.process":
      return processSubmission(String(payload.submissionId));
    case "result.read":
      return processResultRead(String(payload.postId));
    case "discord.grantElite":
      return grantEliteRole(String(payload.userId));
    default:
      throw new Error(`type de tâche inconnu : ${type}`);
  }
}

async function housekeeping() {
  const released = await releaseStuckJobs();
  // Soumissions restées « en analyse » sans tâche active (worker arrêté) : remises en erreur, l'élève peut relancer.
  const stuck = await prisma.submission.updateMany({
    where: { status: "PROCESSING", createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
    data: { status: "ERROR", technicalFailures: { increment: 1 }, lastError: "analyse bloquée" },
  });
  // Résultats restés « en lecture » sans tâche active : passés en vérification à la main.
  const unread = await prisma.resultPost.updateMany({
    where: { status: "ANALYZING", createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
    data: { status: "PENDING", aiReport: { error: "Lecture par l'IA bloquée : vérification à la main." } },
  });
  if (unread.count) console.log(`[worker] ${unread.count} résultat(s) passé(s) en vérification à la main`);
  const orphans = await cleanupOrphanAssets();
  const revoked = await processAbsences();
  await pruneNotifications();
  if (revoked) console.log(`[worker] ${revoked} coaching(s) révoqué(s) pour absence`);
  if (released || stuck.count || orphans) console.log(`[worker] ménage : ${released} tâches relancées, ${stuck.count} soumissions débloquées, ${orphans} fichiers orphelins supprimés`);
}

async function main() {
  getEnv(); // configuration vérifiée dès le démarrage
  console.log("[worker] démarré");
  let lastHousekeeping = 0;
  let lastReminders = 0;
  let lastDms = 0;
  while (!stopping) {
    if (Date.now() - lastReminders > REMINDERS_MS) {
      lastReminders = Date.now();
      await sendDeadlineReminders()
        .then((n) => n && console.log(`[worker] ${n} rappel(s) de délai envoyé(s)`))
        .catch((e) => console.error("[worker] rappels", e));
      await processResponseWaits().catch((e) => console.error("[worker] délais coachs", e));
      await processOutcomeReminders().catch((e) => console.error("[worker] retours de conseils", e));
      await runEngagement()
        .then((n) => n && console.log(`[worker] ${n} relance(s) créée(s)`))
        .catch((e) => console.error("[worker] relances", e));
    }
    // Messages privés Discord des notifications (heures calmes et plafond du jour respectés).
    if (Date.now() - lastDms > DMS_MS) {
      lastDms = Date.now();
      await deliverPendingDms()
        .then((n) => n && console.log(`[worker] ${n} message(s) privé(s) envoyé(s)`))
        .catch((e) => console.error("[worker] messages privés", e));
    }
    if (Date.now() - lastHousekeeping > HOUSEKEEPING_MS) {
      lastHousekeeping = Date.now();
      await housekeeping().catch((e) => console.error("[worker] ménage", e));
    }
    const job = await claimNextJob().catch((e) => {
      console.error("[worker] file indisponible", e);
      return null;
    });
    if (!job) {
      await new Promise((r) => setTimeout(r, IDLE_MS));
      continue;
    }
    const started = Date.now();
    try {
      await handle(job.type, job.payload);
      await completeJob(job.id);
      console.log(`[worker] ${job.type} ${job.id} terminé en ${Date.now() - started} ms`);
    } catch (e) {
      const retry = await failJob(job, e);
      console.error(`[worker] ${job.type} ${job.id} échec (${retry ? "nouvel essai prévu" : "abandon"})`, e);
    }
  }
  await prisma.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
main();
