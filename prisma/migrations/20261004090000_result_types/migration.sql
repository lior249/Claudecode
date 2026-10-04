-- Types de résultats : remplacent les preuves de vues, les preuves de rang et les anciens posts de résultats.
-- Les anciens posts (sans type) et leurs réactions sont supprimés : la base repart à zéro avec cette version.
DELETE FROM "PostReaction";
DELETE FROM "ResultPost";
-- CreateEnum
CREATE TYPE "ResultMetric" AS ENUM ('NONE', 'VIEWS', 'REVENUE_EUR', 'FOLLOWERS');

-- CreateEnum
CREATE TYPE "ResultSpecial" AS ENUM ('NONE', 'MONTHLY_REVENUE', 'FOLLOWERS_RANK');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('ANALYZING', 'PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "RankProof" DROP CONSTRAINT "RankProof_learnerId_fkey";

-- DropForeignKey
ALTER TABLE "ViewProof" DROP CONSTRAINT "ViewProof_postId_fkey";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "validatedViews";

-- AlterTable
ALTER TABLE "ResultPost" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiReport" JSONB,
ADD COLUMN     "dailyCode" TEXT NOT NULL,
ADD COLUMN     "identifier" TEXT,
ADD COLUMN     "imageSha256" TEXT NOT NULL,
ADD COLUMN     "metricValue" INTEGER,
ADD COLUMN     "month" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "typeId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ResultStatus" NOT NULL DEFAULT 'ANALYZING';

-- DropTable
DROP TABLE "RankProof";

-- DropTable
DROP TABLE "ViewProof";

-- DropEnum
DROP TYPE "RankProofKind";

-- CreateTable
CREATE TABLE "ResultType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "exampleKey" TEXT,
    "aiMustHave" TEXT NOT NULL DEFAULT '',
    "aiMustNotHave" TEXT NOT NULL DEFAULT '',
    "aiIdentifier" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 1,
    "metric" "ResultMetric" NOT NULL DEFAULT 'NONE',
    "tiers" JSONB NOT NULL DEFAULT '[]',
    "special" "ResultSpecial" NOT NULL DEFAULT 'NONE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultType_isActive_position_idx" ON "ResultType"("isActive", "position");

-- CreateIndex
CREATE INDEX "ResultPost_status_createdAt_idx" ON "ResultPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ResultPost_typeId_status_createdAt_idx" ON "ResultPost"("typeId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ResultPost" ADD CONSTRAINT "ResultPost_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ResultType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Types de départ (modifiables dans l'admin ; les deux types spéciaux ne peuvent pas être supprimés).
INSERT INTO "ResultType" ("id", "name", "instructions", "exampleKey", "aiMustHave", "aiMustNotHave", "aiIdentifier", "points", "metric", "tiers", "special", "position", "updatedAt") VALUES
('rt_video', 'Résultat d''une vidéo',
 'Capture de l''écran « Video analysis » de TikTok Studio (onglet Overview), recadrée : on voit la date de publication, les compteurs et les « Key metrics ». Coupe le haut de l''écran pour cacher la vidéo (ta niche reste secrète). Écris ton code du jour sur la capture.',
 'exemples/resultat-video.jpg',
 'L''écran « Video analysis » de TikTok Studio : la date « Posted on … », les compteurs (vues, j''aime, commentaires, partages, enregistrements) et le bloc « Key metrics » avec « Video views ».',
 'L''image de la vidéo elle-même, la miniature, le nom du compte, la description de la vidéo ou tout élément qui dévoile la niche.',
 'La date et l''heure de publication (« Posted on … »).',
 0, 'VIEWS', '[{"min":10000,"points":1},{"min":100000,"points":2},{"min":300000,"points":3},{"min":500000,"points":4},{"min":1000000,"points":5}]', 'NONE', 1, CURRENT_TIMESTAMP),
('rt_monthly', 'Revenus du mois',
 'À envoyer le dernier jour du mois : capture de ton tableau de bord de revenus du mois (montant total visible en euros). Écris ton code du jour sur la capture.',
 NULL,
 'Un tableau de bord de revenus (programme de monétisation) avec le montant total du mois.',
 'Le nom du compte, la photo de profil ou tout élément qui dévoile la niche.',
 '',
 2, 'REVENUE_EUR', '[{"min":0,"points":2},{"min":100,"points":3},{"min":500,"points":5},{"min":1000,"points":8}]', 'MONTHLY_REVENUE', 2, CURRENT_TIMESTAMP),
('rt_followers', '10 000 abonnés',
 'Capture de ton profil TikTok où l''on voit le nombre d''abonnés (10 000 ou plus). Écris ton code du jour sur la capture.',
 NULL,
 'Le nombre d''abonnés (« Followers » / « Abonnés ») du compte, 10 000 ou plus.',
 'Les vidéos du compte (miniatures) qui dévoilent la niche.',
 '',
 3, 'FOLLOWERS', '[]', 'FOLLOWERS_RANK', 3, CURRENT_TIMESTAMP);
