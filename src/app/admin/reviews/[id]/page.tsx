import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getReview } from "@/server/admin/reviews";
import { ReviewDecision } from "@/components/admin/review-decision";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default async function AdminReview({ params }: PageProps<"/admin/reviews/[id]">) {
  const { id } = await params;
  const r = await getReview(id);
  if (!r) notFound();
  return (
    <div className="space-y-4 pb-10">
      <Link href="/admin/reviews" className="inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Validations
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{r.learner}</h1>
        <p className="text-sm text-muted">
          {r.module} — {r.lesson} · tentative {r.attemptNumber} · envoyée le {new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>

      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="mb-2 font-semibold">Réalisation</h2>
        {r.assets.length === 0 && !r.text && <p className="text-sm text-muted">Fichier supprimé.</p>}
        {r.assets.map((a) => (
          <div key={a.id} className="mb-3">
            {a.kind === "VIDEO" ? (
              <video src={a.url} controls playsInline preload="metadata" className="max-h-[70vh] w-full rounded-2xl bg-black" />
            ) : (
              <audio src={a.url} controls preload="metadata" className="w-full" />
            )}
            <a href={a.url} download={a.originalName} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted underline">
              <Download size={12} /> Télécharger {a.originalName}
            </a>
          </div>
        ))}
        {r.text && <p className="whitespace-pre-line rounded-2xl bg-bg/40 p-4 text-sm">{r.text}</p>}
      </section>

      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="mb-2 font-semibold">Critères de l&apos;exercice</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {r.criteria.map((c, i) => (
            <li key={i}>
              {c.instruction} <span className="text-danger">(−{fmt(c.pointsPerMiss)} par erreur)</span>
            </li>
          ))}
        </ol>
      </section>

      {r.analysis?.media && (
        <section className="rounded-3xl border border-line bg-card p-4 text-sm">
          <h2 className="mb-2 font-semibold">Mesures automatiques</h2>
          <p className="text-muted">
            Durée {fmt(r.analysis.media.durationSeconds)} s · {r.analysis.media.hasAudio ? "avec son" : "sans son"} · cuts à{" "}
            {r.analysis.media.cuts.map((c) => `${fmt(c)} s`).join(", ") || "aucun"} · silences de 0,5 s ou plus :{" "}
            {r.analysis.media.silences.filter((s) => s.duration >= 0.5).length}
          </p>
        </section>
      )}
      <p className="text-xs text-muted">
        Analyse automatique en échec {r.technicalFailures} fois{r.lastError ? ` (dernière erreur : ${r.lastError.slice(0, 160)})` : ""}.
      </p>

      {r.status === "PENDING_HUMAN" ? (
        <ReviewDecision id={r.id} />
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted">
          Déjà traitée ({r.status === "HUMAN_APPROVED" ? "validée" : "refusée"}){r.reviewComment ? ` : ${r.reviewComment}` : "."}
        </p>
      )}
    </div>
  );
}
