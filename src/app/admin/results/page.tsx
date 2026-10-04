import Link from "next/link";
import { ChevronRight, EyeOff, Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listResultTypes } from "@/server/results/service";
import { METRIC_LABELS } from "@/server/results/rules";
import { ResultTypeOrder } from "@/components/admin/result-type-editor";

const SPECIAL = { NONE: null, MONTHLY_REVENUE: "Spécial : rangs S / SS / SSS", FOLLOWERS_RANK: "Spécial : rang A" } as const;

// Types de résultats : ce que les membres peuvent publier, ce que l'IA vérifie et les points gagnés.
export default async function AdminResultTypes() {
  await requireUser(["ADMIN"]);
  const types = await listResultTypes();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Types de résultats</h1>
        <p className="mt-1 text-sm text-muted">Chaque type a sa consigne, son exemple, ce que l&apos;IA doit (ou ne doit pas) trouver sur la capture, et ses points.</p>
      </div>
      <Link href="/admin/results/new" className="flex items-center justify-center gap-2 rounded-2xl bg-text py-4 font-semibold text-black">
        <Plus size={18} /> Ajouter un type de résultat
      </Link>
      <ul className="space-y-2">
        {types.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2 rounded-3xl border border-line bg-card p-3 pl-4">
            <Link href={`/admin/results/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="line-clamp-2 break-words">{t.name}</span>
                  {!t.isActive && <EyeOff size={14} className="shrink-0 text-muted" aria-label="Masqué" />}
                </span>
                <span className="block text-xs text-muted">
                  {t.metric !== "NONE" && t.tiers.length ? `Paliers sur les ${METRIC_LABELS[t.metric].unit}` : `${t.points} pt${t.points > 1 ? "s" : ""}`}
                  {SPECIAL[t.special] && ` · ${SPECIAL[t.special]}`} · {t.posts} résultat{t.posts > 1 ? "s" : ""}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </Link>
            <ResultTypeOrder id={t.id} first={i === 0} last={i === types.length - 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}
