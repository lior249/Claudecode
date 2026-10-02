-- CreateEnum
CREATE TYPE "Catalog" AS ENUM ('NICHE', 'COUNTRY', 'METHOD_10K');

-- CreateEnum
CREATE TYPE "Competition" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('PC', 'PHONE', 'BOTH');

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "catalog" "Catalog" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "competition" "Competition",
    "equipment" "Equipment",
    "thumbnailKey" TEXT,
    "imageKeys" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItem_catalog_position_idx" ON "CatalogItem"("catalog", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionResponse_userId_lessonId_key" ON "DecisionResponse"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchReport_userId_lessonId_key" ON "LaunchReport"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "DecisionResponse" ADD CONSTRAINT "DecisionResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionResponse" ADD CONSTRAINT "DecisionResponse_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionResponse" ADD CONSTRAINT "DecisionResponse_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchReport" ADD CONSTRAINT "LaunchReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchReport" ADD CONSTRAINT "LaunchReport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
