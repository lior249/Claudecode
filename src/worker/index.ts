// Worker : traite la file de tâches (analyse des soumissions) et le ménage périodique.
// Lancement : npm run worker (un processus séparé du site, avec ffmpeg installé).
import "dotenv/config";
import { claimNextJob, completeJob, failJob, releaseStuckJobs } from "@/server/jobs/queue";
import { processSubmission } from "@/server/practice/service";
import { cleanupOrphanAssets } from "@/server/retention/service";
import { grantEliteRole } from "@/server/launch/service";
import { sendDeadlineReminders } from "@/server/reminders/service";
import { prisma } from "@/server/db";

const IDLE_MS = 1500;
const HOUSEKEEPING_MS = 10 * 60 * 1000;
const REMINDERS_MS = 5 * 60 * 1000;
let stopping = false;

async function handle(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "submission.process":
      return processSubmission(String(payload.submissionId));
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
  const orphans = await cleanupOrphanAssets();
  if (released || stuck.count || orphans) console.log(`[worker] ménage : ${released} tâches relancées, ${stuck.count} soumissions débloquées, ${orphans} fichiers orphelins supprimés`);
}

async function main() {
  console.log("[worker] démarré");
  let lastHousekeeping = 0;
  let lastReminders = 0;
  while (!stopping) {
    if (Date.now() - lastReminders > REMINDERS_MS) {
      lastReminders = Date.now();
      await sendDeadlineReminders()
        .then((n) => n && console.log(`[worker] ${n} rappel(s) de délai envoyé(s)`))
        .catch((e) => console.error("[worker] rappels", e));
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
