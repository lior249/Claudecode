"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Check, ExternalLink, X } from "lucide-react";
import type { PracticeView } from "@/server/practice/service";
import { requestHumanAction, retrySubmissionAction, submitPracticeAction } from "@/app/actions/practice";
import { TypeBadge } from "@/components/learn/badges";
import { UploadDropzone, type UploadedAsset } from "./upload-dropzone";
import { LocalTime } from "@/components/local-time";
import { Mascot, type Mood } from "@/components/mascot";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const formatTime = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
type Sub = PracticeView["submissions"][number];

export function PracticeScreen({ view, moduleTitle, whopUrl }: { view: PracticeView; moduleTitle: string; whopUrl: string | null }) {
  const router = useRouter();
  const latest = view.submissions[0];
  const passedSub = view.status === "PASSED" ? view.submissions.find((s) => s.status === "PASSED") : undefined;

  // Pendant l'analyse, on rafraîchit toutes les 3 secondes.
  useEffect(() => {
    if (view.status !== "PROCESSING") return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [view.status, router]);

  return (
    <main className="mx-auto min-h-dvh max-w-md lg:max-w-2xl lg:pt-6 px-4 pb-16">
      <header className="flex items-center gap-3 py-5">
        <Link href="/learn" className="rounded-full bg-card p-2 text-muted" aria-label="Retour à ma progression">
          <ArrowLeft size={18} />
        </Link>
        <TypeBadge type="PRACTICE_AI" size={32} />
        <div className="min-w-0">
          <p className="text-xs text-muted">{moduleTitle} · Pratique</p>
          <h1 className="line-clamp-2 break-words leading-snug font-semibold">{view.title}</h1>
        </div>
      </header>

      <section className="rounded-3xl border border-line bg-card p-5">
        <p className="text-sm leading-relaxed">{view.summary}</p>
        {view.criteria.length > 0 && (
          <div className="mt-4 rounded-2xl bg-card-2 p-4 text-sm">
            <p className="font-medium">Critères de validation · {fmt(view.threshold)}/10 minimum</p>
            <ul className="mt-3 space-y-3">
              {view.criteria.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-pre-line text-text/90">{c.instruction}</span>
                    <span className="mt-0.5 block text-xs text-danger">−{fmt(c.pointsPerMiss)} point{c.pointsPerMiss > 1 ? "s" : ""} à chaque erreur</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {whopUrl && (
          <a href={whopUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-card-2 py-3 text-sm font-medium">
            Voir le module sur Whop <ExternalLink size={14} />
          </a>
        )}
      </section>

      <div className="mt-4 space-y-4">
        {view.status === "PASSED" && <PassedCard score={passedSub?.score ?? null} />}
        {view.status === "PROCESSING" && <ProcessingCard />}
        {view.status === "NOT_READY" && (
          <StatusCard mood="neutre" title="Cet exercice n'est pas encore prêt" text="Les critères de correction arrivent bientôt. Reviens un peu plus tard." />
        )}
        {view.status === "PENDING_HUMAN" && (
          <StatusCard mood="serieux" title="Un coach examine ta réalisation" text="Tu recevras sa réponse sur Discord. Tu n'as rien d'autre à faire pour l'instant." />
        )}
        {latest?.status === "ERROR" && view.status === "OPEN" && <ErrorCard view={view} sub={latest} />}
        {latest?.status === "FAILED" && view.status === "OPEN" && <ResultCard sub={latest} threshold={view.threshold} />}
        {latest?.status === "HUMAN_REJECTED" && view.status === "OPEN" && (
          <StatusCard mood="doute" title="Le coach a demandé une correction" text={latest.reviewComment ?? "Renvoie une nouvelle réalisation."} />
        )}
        {view.status === "OPEN" && latest?.status !== "ERROR" && <SubmitForm view={view} />}
        {passedSub && passedSub.criteria.length > 0 && <ResultCard sub={passedSub} threshold={view.threshold} />}
        {view.submissions.length > 0 && <History submissions={view.submissions} />}
      </div>
    </main>
  );
}

function SubmitForm({ view }: { view: PracticeView }) {
  const router = useRouter();
  const [video, setVideo] = useState<UploadedAsset | null>(null);
  const [audio, setAudio] = useState<UploadedAsset | null>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wants = (k: "video" | "audio" | "text") => view.accept.includes(k);
  const ready = (!wants("video") || video) && (!wants("audio") || audio) && (!wants("text") || text.trim().length > 0);
  const again = view.submissions.length > 0;

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitPracticeAction({
        lessonId: view.lessonId,
        assetIds: [video?.id, audio?.id].filter((x): x is string => Boolean(x)),
        text: wants("text") ? text : null,
      });
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  return (
    <section className="space-y-3 rounded-3xl border border-line bg-card p-5">
      <h2 className="font-semibold">{again ? "Nouvelle soumission" : "Envoie ta réalisation"}</h2>
      {wants("video") && <UploadDropzone lessonId={view.lessonId} kind="video" onChange={setVideo} />}
      {wants("audio") && <UploadDropzone lessonId={view.lessonId} kind="audio" onChange={setAudio} />}
      {wants("text") && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Écris ou colle ton texte ici…"
          className="w-full resize-y rounded-2xl border border-line bg-bg p-4 text-sm outline-none focus:border-gold"
        />
      )}
      <button onClick={submit} disabled={!ready || pending} className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40">
        {pending ? "Envoi…" : "Envoyer pour correction"}
      </button>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </section>
  );
}

function ProcessingCard() {
  return (
    <section className="flex items-center gap-4 rounded-3xl border border-gold/40 bg-card p-5">
      <Mascot mood="effort" size={56} className="animate-pulse" />
      <div>
        <p className="font-semibold">Analyse en cours…</p>
        <p className="text-sm text-muted">Ça prend en général moins d&apos;une minute. Tu peux fermer cette page.</p>
      </div>
    </section>
  );
}

function StatusCard({ title, text, mood }: { title: string; text: string; mood: Mood }) {
  return (
    <section className="flex items-center gap-4 rounded-3xl border border-line bg-card p-5">
      <Mascot mood={mood} size={56} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </section>
  );
}

function PassedCard({ score }: { score: number | null }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col items-center rounded-3xl border border-success/50 bg-card p-6 text-center">
        <Mascot mood="amour" size={112} />
        <p className="mt-2 text-xl font-semibold">Exercice validé{score !== null ? ` : ${fmt(score)}/10` : ""}</p>
        <p className="mt-1 text-sm text-muted">La suite de ton parcours est débloquée.</p>
      </div>
      <Link href="/learn" className="block w-full rounded-2xl bg-text py-4 text-center font-semibold text-black">
        Retour à ma progression
      </Link>
    </section>
  );
}

function ResultCard({ sub, threshold }: { sub: Sub; threshold: number }) {
  const passed = sub.status === "PASSED";
  return (
    <section className={`rounded-3xl border bg-card p-5 ${passed ? "border-success/40" : "border-danger/50"}`}>
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">{passed ? "Correction" : `Tentative ${sub.attemptNumber} : pas encore validé`}</p>
        <p className={`flex items-center gap-2 text-2xl font-bold ${passed ? "text-success" : "text-danger"}`}>
          {!passed && <Mascot mood="ko" size={40} />}{sub.score !== null ? fmt(sub.score) : "–"}/10</p>
      </div>
      {!passed && <p className="mt-1 text-sm text-muted">Il te faut {fmt(threshold)}/10. Corrige les points ci-dessous et renvoie une nouvelle réalisation.</p>}
      <ul className="mt-4 space-y-4">
        {sub.criteria.map((c, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.misses > 0 ? "bg-danger text-white" : "bg-success text-black"}`}>
              {c.misses > 0 ? <X size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between gap-2 font-medium">
                <span className="whitespace-pre-line">{c.instruction}</span>
                {c.pointsLost > 0 && <span className="shrink-0 text-danger">−{fmt(c.pointsLost)}</span>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {c.misses === 0 ? "Respecté" : `${c.misses} erreur${c.misses > 1 ? "s" : ""} × ${fmt(c.pointsPerMiss)} point${c.pointsPerMiss > 1 ? "s" : ""}`}
              </span>
              {c.evidence.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {c.evidence.map((e, j) => (
                    <li key={j} className="text-muted">
                      {e.time !== null && <span className="mr-1.5 rounded bg-card-2 px-1.5 py-0.5 text-xs font-medium text-text">{formatTime(e.time)}</span>}
                      {e.detail}
                    </li>
                  ))}
                </ul>
              )}
              {c.comment && <span className="mt-1.5 block text-text/90">{c.comment}</span>}
            </span>
          </li>
        ))}
      </ul>
      {sub.feedback && <p className="mt-4 rounded-2xl bg-card-2 p-4 text-sm">{sub.feedback}</p>}
    </section>
  );
}

function ErrorCard({ view, sub }: { view: PracticeView; sub: Sub }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Une erreur est survenue.");
    });
  return (
    <section className="space-y-3 rounded-3xl border border-danger/50 bg-card p-5">
      <div className="flex items-center gap-3">
        <Mascot mood="perdu" size={56} />
        <p className="font-semibold">Ta demande n&apos;a pas pu être traitée.</p>
      </div>
      <p className="text-sm text-muted">
        Ce n&apos;est pas ta faute : l&apos;analyse a rencontré un problème ({sub.technicalFailures} essai{sub.technicalFailures > 1 ? "s" : ""}).
        Réessaie dans un instant.
      </p>
      <button disabled={pending} onClick={() => run(() => retrySubmissionAction(view.lessonId, sub.id))} className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40">
        Réessayer l&apos;analyse
      </button>
      {view.canAskHuman && (
        <button disabled={pending} onClick={() => run(() => requestHumanAction(view.lessonId, sub.id))} className="w-full rounded-2xl border border-gold/60 py-4 font-semibold text-gold disabled:opacity-40">
          Faire appel à un humain
        </button>
      )}
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "En analyse",
  PASSED: "Validé",
  FAILED: "Non validé",
  ERROR: "Erreur technique",
  PENDING_HUMAN: "Chez le coach",
  HUMAN_APPROVED: "Validé par le coach",
  HUMAN_REJECTED: "Refusé par le coach",
};

function History({ submissions }: { submissions: Sub[] }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-semibold">Mes tentatives</h2>
      <ul className="mt-3 divide-y divide-line text-sm">
        {submissions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-8 text-muted">#{s.attemptNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="block">{STATUS_LABEL[s.status] ?? s.status}</span>
              <span className="block truncate text-xs text-muted">
                <LocalTime iso={s.createdAt} />
                {s.files.map((f) => ` · ${f.name}${f.deleted ? " (fichier supprimé)" : ""}`).join("")}
                {s.hasText ? " · texte" : ""}
              </span>
            </span>
            <span className="font-semibold">{s.score !== null ? `${fmt(s.score)}/10` : "–"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
