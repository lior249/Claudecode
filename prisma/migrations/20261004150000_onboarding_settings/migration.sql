
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);


-- Les données de départ (critères des catalogues, types de résultats) existent déjà : le remplissage initial ne doit pas les recréer.
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('initialized', 'true', CURRENT_TIMESTAMP);
