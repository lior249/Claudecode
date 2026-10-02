"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
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
  agentInstructions: string;
  criteria: { id: string; instruction: string; pointsPerMiss: number }[];
  referenceText: string;
  referenceFileName: string | null;
}

const MAX = 4;
const ACCEPT_LABELS: Record<Accept, string> = { video: "Une vidéo", audio: "Un audio", text: "Un texte" };
let counter = 0;
const newKey = () => `c${++counter}-${Date.now()}`;

const field = "w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

export function PracticeEditor({ lessonId, initial }: { lessonId: string; initial: Initial }) {
  const [summary, setSummary] = useState(initial.summary);
  const [accept, setAccept] = useState<Accept[]>(initial.accept);
  const [agentInstructions, setAgentInstructions] = useState(initial.agentInstructions);
  const [criteria, setCriteria] = useState<Criterion[]>(() =>
    initial.criteria.length
      ? initial.criteria.map((c) => ({ key: newKey(), id: c.id, instruction: c.instruction, points: String(c.pointsPerMiss).replace(".", ",") }))
      : [{ key: newKey(), instruction: "", points: "" }],
  );
  const [referenceText, setReferenceText] = useState(initial.referenceText);
  const [referenceFile, setReferenceFile] = useState<string | null>(initial.referenceFileName);
  const [removeReference, setRemoveReference] = useState(false);
  const [upload, setUpload] = useState<{ progress: number } | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Criterion>) => setCriteria((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const toggle = (a: Accept) => setAccept((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const save = () =>
    start(async () => {
      setMessage(null);
      const parsed = criteria.map((c) => ({ id: c.id, instruction: c.instruction, pointsPerMiss: Number(c.points.replace(",", ".")) }));
      const bad = parsed.findIndex((c) => !Number.isFinite(c.pointsPerMiss) || c.pointsPerMiss <= 0);
      if (bad !== -1) return setMessage({ ok: false, text: `Critère ${bad + 1} : indique les points retirés à chaque erreur (ex. 2).` });
      const res = await savePracticeConfig({ lessonId, summary, accept, agentInstructions, criteria: parsed, referenceText, removeReferenceFile: removeReference });
      if (res.ok && removeReference) {
        setReferenceFile(null);
        setRemoveReference(false);
      }
      setMessage(res.ok ? { ok: true, text: "Enregistré. Les prochains envois seront corrigés avec ces critères." } : { ok: false, text: res.error });
    });

  function sendReference(file: File) {
    setMessage(null);
    setUpload({ progress: 0 });
    const req = new XMLHttpRequest();
    req.open("POST", `/api/admin/lessons/${lessonId}/reference`);
    req.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    req.upload.onprogress = (e) => e.lengthComputable && setUpload({ progress: e.loaded / e.total });
    req.onload = () => {
      setUpload(null);
      let body: { asset?: { originalName: string }; error?: string } = {};
      try {
        body = JSON.parse(req.responseText);
      } catch {}
      if (req.status === 200 && body.asset) {
        setReferenceFile(body.asset.originalName);
        setRemoveReference(false);
        setMessage({ ok: true, text: "Fichier de référence enregistré." });
      } else setMessage({ ok: false, text: body.error ?? "Envoi impossible. Réessaie." });
    };
    req.onerror = () => {
      setUpload(null);
      setMessage({ ok: false, text: "Connexion interrompue. Réessaie." });
    };
    req.send(file);
  }

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

      <Section
        title="Consigne pour l'agent"
        hint="Tout ce que l'agent doit savoir : l'exercice, le script, les timings, les tolérances, des exemples. Jamais montré à l'élève."
      >
        <textarea
          value={agentInstructions}
          onChange={(e) => setAgentInstructions(e.target.value)}
          rows={10}
          placeholder={"Ex. : L'élève monte la vidéo fournie. 4 cuts sont attendus : à 3 s, 5 s, 8 s et 13 s, avec une tolérance de ± 0,5 s…"}
          className={field}
        />
      </Section>

      <Section title={`Critères de notation (${criteria.length}/${MAX})`} hint="Visibles par l'élève. L'agent compte combien de fois chaque critère n'est pas respecté.">
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

      <Section title="Éléments de référence" hint="Jamais montrés à l'élève.">
        <label className="block text-xs text-muted">
          Texte de référence (script exact) — le serveur calcule le pourcentage exact de ressemblance avec le texte de l&apos;élève
          <textarea value={referenceText} onChange={(e) => setReferenceText(e.target.value)} rows={5} className={`${field} mt-1`} />
        </label>
        <div className="mt-3 rounded-2xl border border-line p-3 text-sm">
          <p className="text-xs text-muted">Fichier de référence (vidéo ou audio d&apos;exemple) — l&apos;analyste le compare à la réalisation</p>
          {upload ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-card-2">
              <div className="h-full rounded-full bg-gold" style={{ width: `${upload.progress * 100}%` }} />
            </div>
          ) : referenceFile && !removeReference ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{referenceFile}</span>
              <button type="button" onClick={() => setRemoveReference(true)} className="text-xs text-muted underline">
                Retirer
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className="mt-2 flex items-center gap-2 rounded-xl bg-card-2 px-3 py-2">
              <Upload size={14} /> Choisir un fichier
            </button>
          )}
          {removeReference && <p className="mt-1 text-xs text-gold">Sera retiré à l&apos;enregistrement.</p>}
          <input
            ref={fileInput}
            type="file"
            accept="video/*,audio/*,.mp4,.mov,.webm,.mp3,.wav,.m4a"
            className="hidden"
            aria-label="Fichier de référence"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendReference(f);
            }}
          />
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card-2/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
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
