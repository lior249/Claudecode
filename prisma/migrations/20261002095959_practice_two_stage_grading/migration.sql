/*
  Warnings:

  - You are about to drop the column `measurements` on the `Submission` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isReference" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "measurements",
ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "criteriaSnapshot" JSONB;
