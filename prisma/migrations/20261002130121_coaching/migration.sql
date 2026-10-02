-- CreateEnum
CREATE TYPE "CoachingStatus" AS ENUM ('NONE', 'ACTIVE', 'REVOKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TicketOrigin" AS ENUM ('LEARNER', 'COACH');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketRating" AS ENUM ('BAD', 'NEUTRAL', 'GOOD');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'ACK', 'OUTCOME');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RankProofKind" AS ENUM ('FOLLOWERS_10K', 'MONTHLY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coachFastAnswers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coachStars" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "coachingEndedAt" TIMESTAMP(3),
ADD COLUMN     "coachingStartedAt" TIMESTAMP(3),
ADD COLUMN     "coachingStatus" "CoachingStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "tiktokUsername" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "origin" "TicketOrigin" NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "rating" "TicketRating",
    "ratingComment" TEXT,
    "ratedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "imageKeys" JSONB NOT NULL DEFAULT '[]',
    "followUpHours" INTEGER,
    "acknowledgedAt" TIMESTAMP(3),
    "outcomeDueAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseWait" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "late" BOOLEAN NOT NULL DEFAULT false,
    "lateWeek" TEXT,
    "fast" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResponseWait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachStarEvent" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachStarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "localDate" TEXT NOT NULL,
    "validatedViews" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewProof" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "views" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankProof" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" "RankProofKind" NOT NULL,
    "month" TEXT,
    "amountEur" INTEGER,
    "followers" INTEGER,
    "imageKey" TEXT NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactivationRequest" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactivationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_learnerId_status_idx" ON "Ticket"("learnerId", "status");

-- CreateIndex
CREATE INDEX "Ticket_coachId_status_idx" ON "Ticket"("coachId", "status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ResponseWait_coachId_answeredAt_idx" ON "ResponseWait"("coachId", "answeredAt");

-- CreateIndex
CREATE INDEX "ResponseWait_answeredAt_dueAt_idx" ON "ResponseWait"("answeredAt", "dueAt");

-- CreateIndex
CREATE INDEX "CoachStarEvent_coachId_createdAt_idx" ON "CoachStarEvent"("coachId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_learnerId_localDate_idx" ON "Post"("learnerId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Post_learnerId_videoId_key" ON "Post"("learnerId", "videoId");

-- CreateIndex
CREATE INDEX "RankProof_learnerId_kind_idx" ON "RankProof"("learnerId", "kind");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseWait" ADD CONSTRAINT "ResponseWait_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewProof" ADD CONSTRAINT "ViewProof_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankProof" ADD CONSTRAINT "RankProof_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
