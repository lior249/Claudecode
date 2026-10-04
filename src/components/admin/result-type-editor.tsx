"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { ResultTypeView } from "@/server/results/service";
import { METRIC_LABELS, type Metric } from "@/server/results/labels";
import { deleteResultTypeAction, moveResultTypeAction, saveResultTypeAction } from "@/app/actions/results";

const field = "w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";
const METRICS: Exclude<Metric, "NONE">[] = ["VIEWS", "REVENUE_EUR", "FOLLOWERS"];

function uploadExample(file: File): Promise<{ key: string; url: string }> {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open("POST", "/api/admin/catalog/images");
    req.onload = () => {
      let body: { key?: string; url?: string; error?: string } = {};
      try {
        body = JSON.parse(req.responseText);
      } catch {}
      if (req.status === 200 && body.key && body.url) resolve({ key: body.key, url: body.url });
      else reject(new Error(body.error ?? "Envoi impossible. Réessaie."));
    };
    req.onerror = () => reject(new Error("Connexion interrompue. Réessaie."));
    req.send(file);
  });
}

// Fiche d'un type de résultat : ce que voit le membre, ce que vérifie l'IA, les points.
export function ResultTypeEditor({ initial }: { initial: ResultTypeView | null }) {
  const router = useRouter();
  const special = initial?.special ?? "NONE";
  const [name, setName] = useState(initial?.name ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [example, setExample] = useState<{ key: string; url: string } | null>(initial?.exampleKey && initial.exampleUrl ? { key: initial.exampleKey, url: initial.exampleUrl } : null);
  const [mustHave, setMustHave] = useState(initial?.aiMustHave ?? "");
  const [mustNotHave, setMustNotHave] = useState(initial?.aiMustNotHave ?? "");
  const [identifier, setIdentifier] = useState(initial?.aiIdentifier ?? "");
  const [points, setPoints] = useState(String(initial?.points ?? 1));
  const [metric, setMetric] = useState<Metric>(initial?.metric ?? "NONE");
  const [tiers, setTiers] = useState(initial?.tiers.map((t) => ({ min: String(t.min), points: String(t.points) })) ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const useTiers = metric !== "NONE";

  const save = () =>
    start(async () => {
      setMessage(null);
      const res = await saveResultTypeAction({
        id: initial?.id ?? null,
        name,
        instructions,
        exampleKey: example?.key ?? null,
        aiMustHave: mustHave,
        aiMustNotHave: mustNotHave,
        aiIdentifier: identifier,
        points: Number(points || 0),
        metric,
        tiers: useTiers ? tiers.filter((t) => t.min !== "" && t.points !== "").map((t) => ({ min: Number(t.min), points: Number(t.points) })) : [],
        isActive,
      });
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setMessage({ ok: true, text: "Type enregistré." });
      if (!initial) router.replace(`/admin/results/${res.id}`);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!initial || !window.confirm(`Supprimer le type « ${initial.name} » ? S'il a déjà des résultats, il sera seulement masqué.`)) return;
      const res = await deleteResultTypeAction(initial.id);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      router.replace("/admin/results");
    });

  return (
    <div className="mt-6 space-y-5 pb-28">
      <Section title="Ce que voit le membre" hint="Le nom apparaît dans la liste « Publier un résultat » ; la consigne et l'exemple sur la page du type.">
        <label className="block text-xs text-muted">
          Nom du type
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. : Résultat d'une vidéo, Résultat d'une semaine, Nouveau compte monétisé" className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Consigne
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={3000} placeholder="Quelle capture envoyer, comment la recadrer…" className={`${field} mt-1`} />
        </label>
        <p className="mt-3 text-xs text-muted">Exemple visuel</p>
        <div className="mt-1 flex items-center gap-3">
          {example ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={example.url} alt="" className="h-28 w-auto rounded-xl border border-line object-contain" />
              <button type="button" onClick={() => setExample(null)} className="text-sm text-muted underline">
                Retirer
              </button>
            </>
          ) : (
            <button type="button" disabled={uploading} onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-xl bg-card-2 px-3 py-2 text-sm">
              <ImagePlus size={16} /> {uploading ? "Envoi…" : "Ajouter un exemple"}
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Exemple visuel"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              try {
                setExample(await uploadExample(f));
              } catch (err) {
                setMessage({ ok: false, text: (err as Error).message });
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
      </Section>

      <Section title="Ce que vérifie l'IA" hint="Claude lit chaque capture avec ces consignes. Le code du jour du membre est toujours vérifié.">
        <label className="block text-xs text-muted">
          Ce qui doit se trouver sur la capture
          <textarea value={mustHave} onChange={(e) => setMustHave(e.target.value)} rows={3} maxLength={3000} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Ce qui ne doit absolument pas s&apos;y trouver
          <textarea value={mustNotHave} onChange={(e) => setMustNotHave(e.target.value)} rows={3} maxLength={3000} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Ce qui rend ce résultat unique (facultatif) — un même résultat ne rapporte qu&apos;une fois
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} maxLength={300} placeholder="Ex. : la date et l'heure de publication de la vidéo" className={`${field} mt-1`} />
        </label>
      </Section>

      <Section title="Points" hint="Un chiffre fixe, ou des paliers selon un chiffre lu sur la capture.">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useTiers} disabled={special !== "NONE"} onChange={(e) => setMetric(e.target.checked ? "VIEWS" : "NONE")} className="h-4 w-4 accent-[var(--color-gold)]" />
          Points selon un chiffre lu (paliers)
        </label>
        {!useTiers ? (
          <label className="mt-3 block text-xs text-muted">
            Points si la capture est conforme
            <input value={points} onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={`${field} mt-1 max-w-32`} />
          </label>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-muted">
              Chiffre lu par l&apos;IA
              <select value={metric} disabled={special !== "NONE"} onChange={(e) => setMetric(e.target.value as Metric)} className={`${field} mt-1 max-w-60`}>
                {METRICS.map((m) => (
                  <option key={m} value={m}>
                    {METRIC_LABELS[m].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <input value={t.min} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, min: e.target.value.replace(/\D/g, "") } : x)))} inputMode="numeric" placeholder="À partir de" aria-label="À partir de" className={`${field} max-w-40`} />
                  <span className="shrink-0 text-muted">{METRIC_LABELS[metric].unit} →</span>
                  <input value={t.points} onChange={(e) => setTiers(tiers.map((x, k) => (k === i ? { ...x, points: e.target.value.replace(/\D/g, "") } : x)))} inputMode="numeric" placeholder="Points" aria-label="Points" className={`${field} max-w-24`} />
                  <span className="shrink-0 text-muted">pts</span>
                  <button type="button" onClick={() => setTiers(tiers.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-muted hover:text-danger" aria-label="Retirer ce palier">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setTiers([...tiers, { min: "", points: "" }])} className="flex items-center gap-1 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
                <Plus size={14} /> Ajouter un palier
              </button>
            </div>
            <p className="text-xs text-muted">Sous le premier palier : 0 point. Un même résultat (même identifiant) qui passe un palier plus tard ne rapporte que la différence.</p>
          </div>
        )}
        {special === "MONTHLY_REVENUE" && <p className="mt-3 text-xs text-gold">Type spécial : envoi le dernier jour du mois seulement ; donne les rangs S (100 €), SS (500 €) et SSS (1 000 €, fin du coaching).</p>}
        {special === "FOLLOWERS_RANK" && <p className="mt-3 text-xs text-gold">Type spécial : 10 000 abonnés ou plus donnent le rang A.</p>}
      </Section>

      <Section title="Visibilité">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          Proposé aux membres
        </label>
        {initial && special === "NONE" && (
          <button type="button" disabled={pending} onClick={remove} className="mt-4 flex items-center gap-1.5 text-sm text-danger">
            <Trash2 size={14} /> Supprimer ce type
          </button>
        )}
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card-2/95 p-4 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3 lg:max-w-6xl lg:px-6">
          <p className={`min-w-0 flex-1 text-sm ${message ? (message.ok ? "text-success" : "text-danger") : "text-muted"}`}>{message?.text ?? "Les changements s'appliquent aux prochains envois."}</p>
          <button disabled={pending || uploading || name.trim().length < 2} onClick={save} className="rounded-2xl bg-text px-5 py-3 font-semibold text-black disabled:opacity-40">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4 lg:p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

// Flèches pour réordonner les types (ordre de la liste « Publier un résultat »).
export function ResultTypeOrder({ id, first, last }: { id: string; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (dir: number) => start(async () => void ((await moveResultTypeAction(id, dir)).ok && router.refresh()));
  return (
    <span className="flex shrink-0 flex-col">
      <button disabled={pending || first} onClick={() => move(-1)} className="rounded-lg p-1 text-muted hover:text-text disabled:opacity-30" aria-label="Monter">
        <ChevronUp size={16} />
      </button>
      <button disabled={pending || last} onClick={() => move(1)} className="rounded-lg p-1 text-muted hover:text-text disabled:opacity-30" aria-label="Descendre">
        <ChevronDown size={16} />
      </button>
    </span>
  );
}
