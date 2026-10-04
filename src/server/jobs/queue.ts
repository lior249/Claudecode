import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

// File de tâches minimale dans PostgreSQL (SKIP LOCKED : plusieurs workers possibles).

export type JobType = "submission.process" | "discord.grantElite" | "result.read";

export async function enqueue(type: JobType, payload: Prisma.InputJsonValue, runAt = new Date(), maxAttempts = 3) {
  return prisma.job.create({ data: { type, payload, runAt, maxAttempts } });
}

export interface ClaimedJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export async function claimNextJob(): Promise<ClaimedJob | null> {
  const rows = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" SET status = 'RUNNING', "lockedAt" = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "Job" WHERE status = 'PENDING' AND "runAt" <= now()
      ORDER BY "runAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id, type, payload, attempts, "maxAttempts"`;
  return rows[0] ?? null;
}

export async function completeJob(id: string) {
  await prisma.job.update({ where: { id }, data: { status: "DONE", finishedAt: new Date(), lockedAt: null } });
}

export async function failJob(job: ClaimedJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const retry = job.attempts < job.maxAttempts;
  await prisma.job.update({
    where: { id: job.id },
    data: retry
      ? { status: "PENDING", lockedAt: null, lastError: message, runAt: new Date(Date.now() + 30_000 * job.attempts) }
      : { status: "FAILED", lockedAt: null, lastError: message, finishedAt: new Date() },
  });
  return retry;
}

// Tâches bloquées (worker arrêté en plein travail) : remises en file.
export async function releaseStuckJobs(olderThanMs = 15 * 60 * 1000) {
  const { count } = await prisma.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "PENDING", lockedAt: null },
  });
  return count;
}
