import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { accountBarData } from "@/server/profile/menu";
import { blockedReason, getResultType, todayCode } from "@/server/results/service";
import { METRIC_LABELS } from "@/server/results/rules";
import { PageHeader } from "@/components/shell/page-header";
import { ResultForm } from "@/components/results/new-result-post";
import { Mascot } from "@/components/mascot";

// Page d'un type : consigne, exemple, points, code du jour, puis l'envoi de la capture.
export default async function PublishTypePage({ params }: PageProps<"/resultats/publier/[typeId]">) {
  const user = await requireUser();
  const { typeId } = await params;
  const type = await getResultType(typeId);
  if (!type || !type.isActive) notFound();
  const blocked = await blockedReason(user.id, type.id);
  const metric = METRIC_LABELS[type.metric];
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 lg:max-w-4xl lg:pt-5">
      <PageHeader title={type.name} back="/resultats/publier" account={await accountBarData(user)} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="space-y-4 rounded-3xl border border-line bg-card p-4 lg:p-5">
          {type.instructions && <p className="whitespace-pre-line text-sm leading-relaxed">{type.instructions}</p>}
          <div className="rounded-2xl bg-card-2 p-3 text-sm">
            <p className="font-semibold">Points</p>
            {type.metric !== "NONE" && type.tiers.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-muted">
                {type.tiers.map((t) => (
                  <li key={t.min}>
                    {t.min.toLocaleString("fr-FR")} {metric.unit} et plus : <b className="text-gold">{t.points} pt{t.points > 1 ? "s" : ""}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted">
                <b className="text-gold">{type.points} pt{type.points > 1 ? "s" : ""}</b> si ta capture est conforme.
              </p>
            )}
          </div>
          {type.exampleUrl && (
            <figure>
              <figcaption className="mb-2 text-sm font-semibold">Exemple de capture attendue</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={type.exampleUrl} alt={`Exemple : ${type.name}`} className="w-full rounded-2xl border border-line" />
            </figure>
          )}
        </section>
        {blocked ? (
          <section className="flex flex-col items-center rounded-3xl border border-line bg-card p-6 text-center">
            <Mascot mood="doute" size={80} />
            <p className="mt-3 font-semibold">{blocked}</p>
          </section>
        ) : (
          <ResultForm typeId={type.id} dailyCode={await todayCode(user.id)} />
        )}
      </div>
    </main>
  );
}
