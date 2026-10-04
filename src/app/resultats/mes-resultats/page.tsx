import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { listResultPosts } from "@/server/results/service";
import { PageHeader } from "@/components/shell/page-header";
import { PostGallery } from "@/components/results/post-gallery";

// Mes résultats : publiés, en lecture par l'IA, en vérification ou refusés.
export default async function MyResultsPage({ searchParams }: PageProps<"/resultats/mes-resultats">) {
  const user = await requireUser();
  const sent = (await searchParams).envoye === "1";
  const posts = await listResultPosts(user.id, user.id);
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 lg:max-w-3xl lg:pt-5">
      <PageHeader title="Mes résultats" back="/resultats" account={await accountBarData(user)}>
        <Link href="/resultats/publier" className="flex items-center gap-1.5 rounded-full bg-text px-3.5 py-2 text-sm font-semibold text-black">
          <Plus size={16} /> Publier
        </Link>
      </PageHeader>
      {sent && <p className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">Résultat envoyé ! L&apos;IA lit ta capture : tu reçois une notification dès qu&apos;il est publié.</p>}
      <PostGallery title="Tous mes résultats" items={posts} empty="Publie ton premier résultat : une vidéo qui marche, tes revenus, tes abonnés…" />
    </main>
  );
}
