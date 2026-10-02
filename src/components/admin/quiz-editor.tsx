"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { saveQuiz } from "@/app/actions/admin-quiz";

type Choice = "A" | "B" | "C" | "D";
interface Q {
  question: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctAnswer: Choice | "";
  explanation: string;
}
const TOTAL = 20;
const empty = (): Q => ({ question: "", answerA: "", answerB: "", answerC: "", answerD: "", correctAnswer: "", explanation: "" });
const isBlank = (q: Q) => !q.question.trim() && !q.answerA.trim() && !q.answerB.trim() && !q.answerC.trim() && !q.answerD.trim();

export function QuizEditor({ lessonId, initial }: { lessonId: string; initial: (Omit<Q, "correctAnswer"> & { correctAnswer: Choice })[] }) {
  const [items, setItems] = useState<Q[]>(() => Array.from({ length: TOTAL }, (_, i) => initial[i] ?? empty()));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (i: number, patch: Partial<Q>) => setItems((prev) => prev.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const filled = items.filter((q) => !isBlank(q)).length;

  const save = () =>
    start(async () => {
      setMessage(null);
      // Les questions vides en fin de liste sont ignorées ; un trou au milieu est refusé.
      const lastFilled = items.map(isBlank).lastIndexOf(false);
      const toSave = items.slice(0, lastFilled + 1);
      const hole = toSave.findIndex(isBlank);
      if (hole !== -1) return setMessage({ ok: false, text: `Question ${hole + 1} : elle est vide alors que les suivantes sont remplies.` });
      const res = await saveQuiz({ lessonId, questions: toSave });
      setMessage(res.ok ? { ok: true, text: `Enregistré : ${toSave.length}/${TOTAL} questions.` } : { ok: false, text: res.error });
    });

  return (
    <div className="mt-6 space-y-4">
      {items.map((q, i) => (
        <fieldset key={i} className="rounded-3xl border border-line bg-card p-4">
          <legend className="px-2 text-sm font-semibold text-muted">Question {i + 1}</legend>
          <textarea
            value={q.question}
            onChange={(e) => update(i, { question: e.target.value })}
            placeholder="Écris la question…"
            rows={2}
            className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold"
          />
          <div className="mt-3 space-y-2">
            {(["A", "B", "C", "D"] as const).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => update(i, { correctAnswer: c })}
                  aria-label={`Réponse ${c} est la bonne`}
                  aria-pressed={q.correctAnswer === c}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    q.correctAnswer === c ? "border-success bg-success text-black" : "border-line text-muted"
                  }`}
                >
                  {q.correctAnswer === c ? <Check size={16} strokeWidth={3} /> : c}
                </button>
                <input
                  value={q[`answer${c}`]}
                  onChange={(e) => update(i, { [`answer${c}`]: e.target.value })}
                  placeholder={`Réponse ${c}`}
                  className="w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold"
                />
              </div>
            ))}
          </div>
          <textarea
            value={q.explanation}
            onChange={(e) => update(i, { explanation: e.target.value })}
            placeholder="Explication courte (affichée après la réponse)"
            rows={2}
            className="mt-3 w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold"
          />
          <p className="mt-2 text-xs text-muted">Clique sur la lettre de la bonne réponse.</p>
        </fieldset>
      ))}

      <div className="sticky bottom-4 rounded-3xl border border-line bg-card-2 p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm">
            <span className={filled === TOTAL ? "text-success" : "text-gold"}>{filled}/20</span> questions remplies
          </p>
          <button onClick={save} disabled={pending} className="rounded-2xl bg-text px-6 py-3 text-sm font-semibold text-black disabled:opacity-40">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
        {message && <p className={`mt-2 text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
