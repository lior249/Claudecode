import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/server/db";
import type { Catalog } from "@/generated/prisma/enums";
import { CATALOGS, parseKeys, parseLinks } from "@/server/decisions/catalog";
import { fileUrl } from "@/server/decisions/service";
import { listCriteria } from "@/server/decisions/criteria";
import { CatalogItemEditor } from "@/components/admin/catalog-item-editor";

export default async function AdminCatalogItem({ params, searchParams }: PageProps<"/admin/catalogs/[id]">) {
  const { id } = await params;
  const c = (await searchParams).c;
  let initial;
  if (id === "new") {
    const catalog: Catalog = typeof c === "string" && c in CATALOGS ? (c as Catalog) : "NICHE";
    initial = { id: null, catalog, title: "", summary: "", body: "", optionIds: [] as string[], thumbnail: null, images: [], links: [], isPublished: true, chosenBy: 0 };
  } else {
    const item = await prisma.catalogItem.findUnique({ where: { id }, include: { _count: { select: { choices: true } }, options: { select: { optionId: true } } } });
    if (!item) notFound();
    initial = {
      id: item.id,
      catalog: item.catalog,
      title: item.title,
      summary: item.summary,
      body: item.body,
      optionIds: item.options.map((o) => o.optionId),
      thumbnail: item.thumbnailKey ? { key: item.thumbnailKey, url: fileUrl(item.thumbnailKey) } : null,
      images: parseKeys(item.imageKeys).map((key) => ({ key, url: fileUrl(key) })),
      links: parseLinks(item.links),
      isPublished: item.isPublished,
      chosenBy: item._count.choices,
    };
  }
  return (
    <div>
      <Link href={`/admin/catalogs?c=${initial.catalog}`} className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> {CATALOGS[initial.catalog].plural}
      </Link>
      <h1 className="text-2xl font-semibold">{initial.id ? initial.title : CATALOGS[initial.catalog].add}</h1>
      <CatalogItemEditor initial={initial} criteria={await listCriteria(initial.catalog)} />
    </div>
  );
}
