-- CreateTable
CREATE TABLE "CatalogCriterion" (
    "id" TEXT NOT NULL,
    "catalog" "Catalog" NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogOption" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemOption" (
    "itemId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "CatalogItemOption_pkey" PRIMARY KEY ("itemId","optionId")
);

-- CreateIndex
CREATE INDEX "CatalogCriterion_catalog_position_idx" ON "CatalogCriterion"("catalog", "position");

-- CreateIndex
CREATE INDEX "CatalogOption_criterionId_position_idx" ON "CatalogOption"("criterionId", "position");

-- CreateIndex
CREATE INDEX "CatalogItemOption_optionId_idx" ON "CatalogItemOption"("optionId");

-- AddForeignKey
ALTER TABLE "CatalogOption" ADD CONSTRAINT "CatalogOption_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "CatalogCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemOption" ADD CONSTRAINT "CatalogItemOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItemOption" ADD CONSTRAINT "CatalogItemOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CatalogOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise de l'existant : « Concurrence » et « Matériel » deviennent des critères modifiables, pour chaque catalogue.
INSERT INTO "CatalogCriterion" ("id", "catalog", "label", "position")
SELECT 'crit_comp_' || c, c::"Catalog", 'Concurrence', 1 FROM unnest(ARRAY['NICHE', 'COUNTRY', 'METHOD_10K']) AS c
UNION ALL
SELECT 'crit_equip_' || c, c::"Catalog", 'Matériel', 2 FROM unnest(ARRAY['NICHE', 'COUNTRY', 'METHOD_10K']) AS c;

INSERT INTO "CatalogOption" ("id", "criterionId", "label", "color", "position")
SELECT 'opt_comp_' || o.k || '_' || c, 'crit_comp_' || c, o.label, o.color, o.pos
FROM unnest(ARRAY['NICHE', 'COUNTRY', 'METHOD_10K']) AS c,
     (VALUES ('LOW', 'Faible', 'green', 1), ('MEDIUM', 'Moyenne', 'yellow', 2), ('HIGH', 'Forte', 'red', 3)) AS o(k, label, color, pos)
UNION ALL
SELECT 'opt_equip_' || o.k || '_' || c, 'crit_equip_' || c, o.label, o.color, o.pos
FROM unnest(ARRAY['NICHE', 'COUNTRY', 'METHOD_10K']) AS c,
     (VALUES ('PHONE', 'Téléphone', 'gray', 1), ('PC', 'PC', 'gray', 2), ('BOTH', 'PC et téléphone', 'gray', 3)) AS o(k, label, color, pos);

INSERT INTO "CatalogItemOption" ("itemId", "optionId")
SELECT "id", 'opt_comp_' || "competition"::text || '_' || "catalog"::text FROM "CatalogItem" WHERE "competition" IS NOT NULL
UNION ALL
SELECT "id", 'opt_equip_' || "equipment"::text || '_' || "catalog"::text FROM "CatalogItem" WHERE "equipment" IS NOT NULL;

-- AlterTable
ALTER TABLE "CatalogItem" DROP COLUMN "competition",
DROP COLUMN "equipment";

-- DropEnum
DROP TYPE "Competition";

-- DropEnum
DROP TYPE "Equipment";
