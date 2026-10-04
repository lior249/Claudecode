import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Download } from "lucide-react";
import { getReview, listPendingReviews } from "@/server/admin/reviews";
import { TypeBadge } from "@/components/learn/badges";
import { MascotState } from "@/components/mascot";
import { GradeForm } from "./grade-form";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const ago = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / 1440)} j`;
};

// Exercices pratiques à corriger (admin et coachs).
export async function ReviewList({ base }: { base: string }) {
  const items = await listPendingReviews();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Exercices à corriger</h1>
        <p className="mt-1 text-sm text-muted">Réalisations envoyées par les élèves : compte les erreurs critère par critère, la note est calculée automatiquement.</p>
      </div>
      {items.length === 0 && (
        <MascotState mood="content" title="Tout est à jour">
          Aucune réalisation à corriger.
        </MascotState>
      )}
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`${base}/${r.id}`} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
              <TypeBadge type="PRACTICE_HUMAN" size={36} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.learner}</span>
                <span className="block truncate text-sm text-muted">
                  {r.module} — {r.lesson} · tentative {r.attemptNumber}
                </span>
              </span>
              <span className="text-xs text-muted">{ago(r.createdAt)}</span>
              <ChevronRight size={16} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Une réalisation : la vidéo / l'audio / le texte, les critères, puis la correction.
export async function ReviewDetail({ id, base }: { id: string; base: string }) {
  const r = await getReview(id);
  if (!r) notFound();
  return (
    <div className="space-y-4 pb-10">
      <Link href={base} className="inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Exercices à corriger
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{r.learner}</h1>
        <p className="text-sm text-muted">
          {r.module} — {r.lesson} · tentative {r.attemptNumber} · envoyée le {new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-3xl border border-line bg-card p-4">
          <h2 className="mb-1 font-semibold">Réalisation</h2>
          {r.summary && <p className="mb-3 text-sm text-muted">Consigne : {r.summary}</p>}
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
        {r.status === "PENDING_HUMAN" ? (
          <GradeForm id={r.id} criteria={r.criteria} threshold={r.threshold} backHref={base} />
        ) : (
          <section className="rounded-3xl border border-line bg-card p-4 text-sm">
            <p className="font-semibold">Déjà corrigée : {r.score !== null ? `${fmt(r.score)}/10` : "—"}</p>
            <ul className="mt-2 space-y-1 text-muted">
              {r.results.map((x, i) => (
                <li key={i}>
                  Critère {i + 1} : {x.misses} erreur{x.misses > 1 ? "s" : ""} (−{fmt(x.pointsLost)}){x.comment && ` — ${x.comment}`}
                </li>
              ))}
            </ul>
            {r.feedback && <p className="mt-2">{r.feedback}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
