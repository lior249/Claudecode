import Link from "next/link";
import { ChevronRight, EyeOff, Plus } from "lucide-react";
import { prisma } from "@/server/db";
import type { Catalog } from "@/generated/prisma/enums";
import { CATALOGS } from "@/server/decisions/catalog";
import { fileUrl } from "@/server/decisions/service";
import { CompetitionBadge, EquipmentBadge } from "@/components/decision/parts";
import { MascotState } from "@/components/mascot";

export default async function AdminCatalogs({ searchParams }: PageProps<"/admin/catalogs">) {
  const c = (await searchParams).c;
  const catalog: Catalog = typeof c === "string" && c in CATALOGS ? (c as Catalog) : "NICHE";
  const items = await prisma.catalogItem.findMany({
    where: { catalog },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { choices: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Catalogues</h1>
      <nav className="flex gap-1 rounded-2xl bg-card p-1">
        {(Object.keys(CATALOGS) as Catalog[]).map((k) => (
          <Link
            key={k}
            href={`/admin/catalogs?c=${k}`}
            className={`flex-1 rounded-xl py-2.5 text-center text-sm ${k === catalog ? "bg-card-2 font-semibold" : "text-muted"}`}
          >
            {CATALOGS[k].plural}
          </Link>
        ))}
      </nav>
      <Link href={`/admin/catalogs/new?c=${catalog}`} className="flex items-center justify-center gap-2 rounded-2xl bg-text py-4 font-semibold text-black">
        <Plus size={18} /> {CATALOGS[catalog].add}
      </Link>
      <div className="space-y-3">
        {items.length === 0 && (
        <MascotState mood="neutre">
          Aucune fiche pour l&apos;instant.
        </MascotState>
      )}
        {items.map((item) => (
          <Link key={item.id} href={`/admin/catalogs/${item.id}`} className="flex items-center gap-4 rounded-3xl border border-line bg-card p-4">
            {item.thumbnailKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl(item.thumbnailKey)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card-2 font-bold text-muted">{item.title.slice(0, 1)}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                <span className="line-clamp-2 break-words leading-snug">{item.title}</span>
                {!item.isPublished && <EyeOff size={14} className="shrink-0 text-muted" aria-label="Masquée" />}
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                <CompetitionBadge value={item.competition} />
                <EquipmentBadge value={item.equipment} />
                <span className="rounded-full bg-card-2 px-2.5 py-1 text-xs text-muted">
                  {item._count.choices} élève{item._count.choices > 1 ? "s" : ""}
                </span>
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
