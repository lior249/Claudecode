"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { savePracticeConfig } from "@/app/actions/admin-practice";

type Accept = "video" | "audio" | "text";
interface Criterion {
  key: string;
  id?: string;
  instruction: string;
  points: string; // saisi tel quel (accepte « 1,5 »)
}
interface Initial {
  summary: string;
  accept: Accept[];
  criteria: { id: string; instruction: string; pointsPerMiss: number }[];
}

const MAX = 3;
const ACCEPT_LABELS: Record<Accept, string> = { video: "Une vidéo", audio: "Un audio", text: "Un texte" };
let counter = 0;
const newKey = () => `c${++counter}-${Date.now()}`;

const field = "w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

export function PracticeEditor({ lessonId, initial }: { lessonId: string; initial: Initial }) {
  const [summary, setSummary] = useState(initial.summary);
  const [accept, setAccept] = useState<Accept[]>(initial.accept);
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
    initial.criteria.length
      ? initial.criteria.map((c) => ({ key: newKey(), id: c.id, instruction: c.instruction, points: String(c.pointsPerMiss).replace(".", ",") }))
      : [{ key: newKey(), instruction: "", points: "" }],
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (key: string, patch: Partial<Criterion>) => setCriteria((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const toggle = (a: Accept) => setAccept((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const save = () =>
    start(async () => {
      setMessage(null);
      const parsed = criteria.map((c) => ({ id: c.id, instruction: c.instruction, pointsPerMiss: Number(c.points.replace(",", ".")) }));
      const bad = parsed.findIndex((c) => !Number.isFinite(c.pointsPerMiss) || c.pointsPerMiss <= 0);
      if (bad !== -1) return setMessage({ ok: false, text: `Critère ${bad + 1} : indique les points retirés à chaque erreur (ex. 2).` });
      const res = await savePracticeConfig({ lessonId, summary, accept, criteria: parsed });
      setMessage(res.ok ? { ok: true, text: "Enregistré. Les prochains envois seront corrigés avec ces critères." } : { ok: false, text: res.error });
    });

  return (
    <div className="mt-6 space-y-5 pb-28">
      <Section title="Consigne affichée à l'élève" hint="Courte et claire : ce qu'il doit faire.">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={field} />
      </Section>

      <Section title="Ce que l'élève envoie">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCEPT_LABELS) as Accept[]).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={accept.includes(a)}
              onClick={() => toggle(a)}
              className={`rounded-full border px-4 py-2 text-sm ${accept.includes(a) ? "border-gold bg-gold/15 text-gold" : "border-line text-muted"}`}
            >
              {ACCEPT_LABELS[a]}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Critères de notation (${criteria.length}/${MAX})`} hint="1 à 3 critères, visibles par l'élève. Le coach ou l'admin compte combien de fois chacun n'est pas respecté ; 8/10 pour valider.">
        <div className="space-y-3">
          {criteria.map((c, i) => (
            <div key={c.key} className="rounded-2xl border border-line bg-bg/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Critère {i + 1}</span>
                {criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCriteria((cs) => cs.filter((x) => x.key !== c.key))}
                    className="flex items-center gap-1 text-xs text-muted"
                    aria-label={`Supprimer le critère ${i + 1}`}
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                )}
              </div>
              <label className="block text-xs text-muted">
                Consigne du critère — ce que l&apos;agent doit vérifier
                <textarea
                  value={c.instruction}
                  onChange={(e) => update(c.key, { instruction: e.target.value })}
                  rows={3}
                  placeholder="Ex. : Chaque cut est placé au bon moment (± 0,5 s)."
                  className={`${field} mt-1`}
                />
              </label>
              <label className="mt-2 flex items-center gap-3 text-xs text-muted">
                Points retirés à chaque erreur
                <input
                  value={c.points}
                  onChange={(e) => update(c.key, { points: e.target.value })}
                  inputMode="decimal"
                  placeholder="2"
                  className="w-20 rounded-xl border border-line bg-bg p-2 text-center text-sm text-text outline-none focus:border-gold"
                />
              </label>
            </div>
          ))}
          {criteria.length < MAX && (
            <button
              type="button"
              onClick={() => setCriteria((cs) => [...cs, { key: newKey(), instruction: "", points: "" }])}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted"
            >
              <Plus size={16} /> Ajouter un critère
            </button>
          )}
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 lg:left-64 z-10 border-t border-line bg-card-2/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 lg:max-w-6xl lg:px-6">
          <p className={`flex-1 text-sm ${message ? (message.ok ? "text-success" : "text-danger") : "text-muted"}`}>
            {message?.text ?? "Les modifications s'appliquent aux prochains envois."}
          </p>
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
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}
