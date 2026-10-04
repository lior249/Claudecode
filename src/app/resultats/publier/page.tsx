import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { listResultTypes } from "@/server/results/service";
import { METRIC_LABELS, parseTiers } from "@/server/results/rules";
import { PageHeader } from "@/components/shell/page-header";
import { MascotState } from "@/components/mascot";

// Choix du type de résultat à publier (liste simple, sans miniature).
export default async function PublishPage() {
  const user = await requireUser();
  const types = await listResultTypes({ activeOnly: true });
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 lg:max-w-2xl lg:pt-5">
      <PageHeader title="Publier un résultat" back="/resultats" account={await accountBarData(user)} />
      <p className="mb-4 text-sm text-muted">Choisis ce que tu veux montrer. Chaque type a sa consigne et son exemple.</p>
      {types.length === 0 ? (
        <MascotState mood="neutre">Aucun type de résultat pour l&apos;instant.</MascotState>
      ) : (
        <ul className="space-y-2">
          {types.map((t) => {
            const tiers = parseTiers(t.tiers);
            const pts = t.metric !== "NONE" && tiers.length ? `jusqu'à ${Math.max(...tiers.map((x) => x.points))} pts selon les ${METRIC_LABELS[t.metric].unit}` : `${t.points} pt${t.points > 1 ? "s" : ""}`;
            return (
              <li key={t.id}>
                <Link href={`/resultats/publier/${t.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 hover:border-gold/50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-sm text-muted">{pts}</span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
