"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ExternalLink, KeyRound } from "lucide-react";
import type { getLaunchView } from "@/server/launch/service";
import { checkLaunchKeyAction, submitLaunchAction } from "@/app/actions/launch";
import { TypeBadge } from "@/components/learn/badges";
import { CrownIcon } from "@/components/ui/icons";

type View = Awaited<ReturnType<typeof getLaunchView>>;

const field = "w-full rounded-2xl border border-line bg-bg p-4 text-sm outline-none focus:border-gold";

export function LaunchFlow({ view, moduleTitle, whopUrl }: { view: View; moduleTitle: string; whopUrl: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<"key" | "questions">("key");
  // Aucun indice : les champs sont vides et sans exemple.
  const [phrase, setPhrase] = useState("");
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState<string[]>(() => view.questions.map(() => ""));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const header = (
    <header className="flex items-center gap-3 py-5">
      <Link href="/learn" className="rounded-full bg-card p-2 text-muted" aria-label="Retour à ma progression">
        <ArrowLeft size={18} />
      </Link>
      <TypeBadge type="CODE_VALIDATION" size={32} />
      <div className="min-w-0">
        <p className="text-xs text-muted">{moduleTitle} · Validation</p>
        <h1 className="line-clamp-2 break-words leading-snug font-semibold">{view.title}</h1>
      </div>
    </header>
  );

  if (view.done) {
    return (
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
        {header}
        <section className="space-y-3">
          <div className="rounded-3xl border border-gold/50 bg-card p-6 text-center">
            <CrownIcon size={64} className="mx-auto" />
            <p className="mt-3 text-xl font-semibold">Félicitations !</p>
            <p className="mt-1 text-sm text-muted">Tu as terminé ton parcours Learn. Ton accès au coaching est débloqué.</p>
            <p className="mt-3 text-sm">
              {view.done.eliteGranted ? "Le rôle @Élite t'a été donné sur Discord." : "Le rôle @Élite arrive sur ton Discord dans quelques instants."}
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 text-sm">
            <p className="font-semibold">Et maintenant ?</p>
            <p className="mt-1 whitespace-pre-line text-muted">{view.done.afterMessage}</p>
          </div>
          <Link href="/learn" className="block w-full rounded-2xl bg-text py-4 text-center font-semibold text-black">
            Retour à ma progression
          </Link>
        </section>
      </main>
    );
  }

  if (!view.ready) {
    return (
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
        {header}
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Cette étape n&apos;est pas encore prête. Reviens un peu plus tard.</p>
      </main>
    );
  }

  const checkKey = () =>
    start(async () => {
      setError(null);
      const res = await checkLaunchKeyAction({ lessonId: view.lessonId, phrase, code });
      if (res.ok) setStep("questions");
      else setError(res.error);
    });

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitLaunchAction({ lessonId: view.lessonId, phrase, code, answers });
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  const filled = answers.filter((a) => a.trim().length >= view.minAnswerChars).length;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16">
      {header}
      <section className="rounded-3xl border border-line bg-card p-5">
        <p className="text-sm leading-relaxed">{view.summary}</p>
        {whopUrl && (
          <a href={whopUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-card-2 py-3 text-sm font-medium">
            Voir le module sur Whop <ExternalLink size={14} />
          </a>
        )}
      </section>

      {step === "key" ? (
        <section className="mt-4 space-y-3 rounded-3xl border border-line bg-card p-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-gold" />
            <h2 className="font-semibold">Phrase de validation et code</h2>
          </div>
          <label className="block text-sm text-muted">
            Phrase de validation
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" className={`${field} mt-1 text-text`} />
          </label>
          <label className="block text-sm text-muted">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${field} mt-1 font-mono tracking-widest text-text uppercase`}
            />
          </label>
          <button disabled={pending || !phrase.trim() || !code.trim()} onClick={checkKey} className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40">
            {pending ? "Vérification…" : "Valider"}
          </button>
          {error && <p className="text-center text-sm text-danger">{error}</p>}
        </section>
      ) : (
        <section className="mt-4 space-y-4">
          <div className="rounded-3xl border border-success/40 bg-card p-5">
            <p className="font-semibold">Bravo, c&apos;est validé ✅</p>
            <p className="mt-1 text-sm text-muted">
              Dernière étape : raconte-nous comment ça s&apos;est passé. Prends le temps de développer, ton coach lira tout.
            </p>
          </div>
          {view.questions.map((q, i) => {
            const len = answers[i].trim().length;
            return (
              <label key={i} className="block rounded-3xl border border-line bg-card p-4">
                <span className="text-sm font-medium">
                  {i + 1}. {q}
                </span>
                <textarea
                  value={answers[i]}
                  onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))}
                  rows={3}
                  maxLength={5000}
                  className={`${field} mt-2`}
                />
                <span className={`mt-1 block text-right text-xs ${len >= view.minAnswerChars ? "text-success" : "text-muted"}`}>
                  {len >= view.minAnswerChars ? "✓" : `${len}/${view.minAnswerChars} caractères minimum`}
                </span>
              </label>
            );
          })}
          <div className="sticky bottom-4 rounded-3xl border border-line bg-card-2 p-4 shadow-2xl">
            <button
              disabled={pending || filled < view.questions.length}
              onClick={submit}
              className="w-full rounded-2xl bg-gold py-4 font-semibold text-black disabled:opacity-40"
            >
              {pending ? "Envoi…" : `Envoyer à mon coach (${filled}/${view.questions.length})`}
            </button>
            {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
