import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { viewsFor } from "@/server/profile/service";
import { listGallery, listResultTypes } from "@/server/results/service";
import { PageHeader } from "@/components/shell/page-header";
import { GalleryWall } from "@/components/results/post-gallery";
import { MascotState } from "@/components/mascot";

// Tous les résultats publiés des membres, du plus récent au plus ancien, avec un filtre par type.
export default async function ResultsPage({ searchParams }: PageProps<"/resultats">) {
  const user = await requireUser();
  const sp = await searchParams;
  const types = await listResultTypes();
  const typeId = typeof sp.type === "string" && types.some((t) => t.id === sp.type) ? sp.type : null;
  const before = typeof sp.avant === "string" && !Number.isNaN(Date.parse(sp.avant)) ? new Date(sp.avant) : null;
  const { items, nextBefore } = await listGallery(user.id, { typeId, before });
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-gold bg-gold/15 font-semibold text-gold" : "border-line text-muted hover:text-text"}`;
  const href = (t: string | null) => (t ? `/resultats?type=${t}` : "/resultats");
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 sm:max-w-3xl lg:max-w-none lg:px-10 lg:pt-5">
      <PageHeader title="Résultats" back={viewsFor(user)[0].href} account={await accountBarData(user)}>
        <Link href="/resultats/publier" aria-label="Publier un résultat" className="flex items-center gap-1.5 rounded-full bg-text p-2.5 text-sm font-semibold text-black sm:px-3.5 sm:py-2">
          <Plus size={18} /> <span className="hidden sm:inline">Publier</span>
        </Link>
      </PageHeader>
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0" aria-label="Filtrer par type">
        <Link href={href(null)} className={chip(!typeId)}>
          Tous
        </Link>
        {types
          .filter((t) => t.isActive || t.posts > 0)
          .map((t) => (
            <Link key={t.id} href={href(t.id)} className={chip(t.id === typeId)}>
              {t.name}
            </Link>
          ))}
        <Link href="/resultats/mes-resultats" className="ml-auto shrink-0 rounded-full px-3.5 py-1.5 text-sm text-muted underline">
          Mes résultats
        </Link>
      </nav>
      {items.length === 0 ? (
        <MascotState mood="neutre" title="Aucun résultat pour l'instant">
          Les résultats publiés par les membres apparaîtront ici.
        </MascotState>
      ) : (
        <GalleryWall items={items} />
      )}
      {nextBefore && (
        <Link href={`/resultats?${typeId ? `type=${typeId}&` : ""}avant=${encodeURIComponent(nextBefore)}`} className="mx-auto mt-6 block w-fit rounded-full bg-card px-5 py-2.5 text-sm font-semibold">
          Résultats plus anciens
        </Link>
      )}
    </main>
  );
}
