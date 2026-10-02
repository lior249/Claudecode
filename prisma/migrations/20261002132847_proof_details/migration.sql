-- AlterTable
ALTER TABLE "RankProof" ADD COLUMN     "videoUrls" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ViewProof" ADD COLUMN     "comments" INTEGER,
ADD COLUMN     "likes" INTEGER;
