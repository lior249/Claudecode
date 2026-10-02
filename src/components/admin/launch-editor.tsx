"use client";

import { useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { newLaunchCode, saveLaunchConfig } from "@/app/actions/admin-launch";

const field = "w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

export function LaunchEditor({
  lessonId,
  initial,
}: {
  lessonId: string;
  initial: { summary: string; phrase: string; code: string; questions: string[]; afterMessage: string };
}) {
  const [summary, setSummary] = useState(initial.summary);
  const [phrase, setPhrase] = useState(initial.phrase);
  const [code, setCode] = useState(initial.code);
  const [questions, setQuestions] = useState(initial.questions);
  const [afterMessage, setAfterMessage] = useState(initial.afterMessage);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () =>
    start(async () => {
      setMessage(null);
      const res = await saveLaunchConfig({ lessonId, summary, phrase, code, questions: questions.filter((q) => q.trim()), afterMessage });
      setMessage(res.ok ? { ok: true, text: "Enregistré." } : { ok: false, text: res.error });
    });

  return (
    <div className="mt-6 space-y-5 pb-28">
      <Section title="Consigne affichée à l'élève">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={field} />
      </Section>

      <Section title="Phrase et code secrets" hint="À montrer à la fin de la vidéo du module sur Whop. Jamais affichés dans Creato.">
        <label className="block text-xs text-muted">
          Phrase de validation
          <input value={phrase} onChange={(e) => setPhrase(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Code (lettres et chiffres)
          <div className="mt-1 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${field} font-mono tracking-widest`} />
            <button
              type="button"
              onClick={() => start(async () => setCode(await newLaunchCode()))}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-card-2 px-3 text-sm"
            >
              <RefreshCw size={14} /> Nouveau
            </button>
          </div>
        </label>
        <p className="mt-2 text-xs text-muted">Majuscules, accents et espaces ne comptent pas quand l&apos;élève les recopie.</p>
      </Section>

      <Section title={`Questions de ressenti (${questions.length})`} hint="Chaque réponse doit faire au moins 30 caractères.">
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-6 pt-3 text-right text-sm text-muted">{i + 1}.</span>
              <input value={q} onChange={(e) => setQuestions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} className={field} />
              <button type="button" onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 px-2 text-muted" aria-label={`Supprimer la question ${i + 1}`}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {questions.length < 20 && (
            <button type="button" onClick={() => setQuestions((prev) => [...prev, ""])} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted">
              <Plus size={16} /> Ajouter une question
            </button>
          )}
        </div>
      </Section>

      <Section title="Message de fin" hint="Affiché après l'envoi : où envoyer les 5 vidéos au coach.">
        <textarea value={afterMessage} onChange={(e) => setAfterMessage(e.target.value)} rows={3} className={field} />
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card-2/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className={`flex-1 text-sm ${message ? (message.ok ? "text-success" : "text-danger") : "text-muted"}`}>{message?.text ?? ""}</p>
          <button onClick={save} disabled={pending} className="rounded-2xl bg-text px-6 py-3 text-sm font-semibold text-black disabled:opacity-40">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {hint ? <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}
