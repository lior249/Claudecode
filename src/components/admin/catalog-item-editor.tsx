"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { Catalog, Competition, Equipment } from "@/generated/prisma/enums";
import { CATALOGS, COMPETITION_LABELS, EQUIPMENT_LABELS } from "@/server/decisions/catalog";
import { deleteCatalogItemAction, saveCatalogItemAction } from "@/app/actions/admin-catalog";

interface Img {
  key: string;
  url: string;
}
interface Initial {
  id: string | null;
  catalog: Catalog;
  title: string;
  summary: string;
  body: string;
  competition: Competition | null;
  equipment: Equipment | null;
  thumbnail: Img | null;
  images: Img[];
  links: { label: string; url: string }[];
  isPublished: boolean;
  chosenBy: number;
}

const field = "w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

function uploadImage(file: File): Promise<Img> {
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

export function CatalogItemEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const c = CATALOGS[initial.catalog];
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [body, setBody] = useState(initial.body);
  const [competition, setCompetition] = useState<Competition | null>(initial.competition);
  const [equipment, setEquipment] = useState<Equipment | null>(initial.equipment);
  const [thumbnail, setThumbnail] = useState<Img | null>(initial.thumbnail);
  const [images, setImages] = useState<Img[]>(initial.images);
  const [links, setLinks] = useState(initial.links);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const thumbInput = useRef<HTMLInputElement>(null);
  const imagesInput = useRef<HTMLInputElement>(null);

  async function addImages(files: FileList | null, asThumbnail: boolean) {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      for (const f of Array.from(files)) {
        const img = await uploadImage(f);
        if (asThumbnail) setThumbnail(img);
        else setImages((prev) => [...prev, img].slice(0, 12));
      }
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const save = () =>
    start(async () => {
      setMessage(null);
      const res = await saveCatalogItemAction({
        id: initial.id,
        catalog: initial.catalog,
        title,
        summary,
        body,
        competition,
        equipment,
        thumbnailKey: thumbnail?.key ?? null,
        imageKeys: images.map((i) => i.key),
        links: links.filter((l) => l.label.trim() || l.url.trim()),
        isPublished,
      });
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setMessage({ ok: true, text: "Fiche enregistrée." });
      if (!initial.id) router.replace(`/admin/catalogs/${res.id}`);
      else router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!initial.id || !window.confirm("Supprimer définitivement cette fiche ?")) return;
      const res = await deleteCatalogItemAction(initial.id);
      if (res.ok) router.replace(`/admin/catalogs?c=${initial.catalog}`);
      else setMessage({ ok: false, text: res.error });
    });

  return (
    <div className="mt-6 space-y-5 pb-28">
      <Section title="Vue d'ensemble" hint="Ce que l'élève voit dans la liste.">
        <label className="block text-xs text-muted">
          Nom
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${field} mt-1`} />
        </label>
        <label className="mt-3 block text-xs text-muted">
          Résumé en une phrase
          <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className={`${field} mt-1`} />
        </label>
        <p className="mt-4 text-xs text-muted">Niveau de concurrence</p>
        <Choices
          options={(Object.keys(COMPETITION_LABELS) as Competition[]).map((k) => ({ value: k, label: COMPETITION_LABELS[k] }))}
          value={competition}
          onChange={setCompetition}
        />
        <p className="mt-4 text-xs text-muted">Matériel nécessaire pour se lancer</p>
        <Choices
          options={(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))}
          value={equipment}
          onChange={setEquipment}
        />
        <p className="mt-4 text-xs text-muted">Miniature</p>
        <div className="mt-1 flex items-center gap-3">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-xl bg-card-2" />
          )}
          <button type="button" disabled={uploading} onClick={() => thumbInput.current?.click()} className="rounded-xl bg-card-2 px-3 py-2 text-sm">
            {thumbnail ? "Changer" : "Choisir une image"}
          </button>
          {thumbnail && (
            <button type="button" onClick={() => setThumbnail(null)} className="text-xs text-muted underline">
              Retirer
            </button>
          )}
        </div>
        <input ref={thumbInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Miniature" onChange={(e) => (addImages(e.target.files, true), (e.target.value = ""))} />
      </Section>

      <Section title="Contenu de la fiche" hint="Comptes exemples, types de contenus, exemples de scripts, pays à cibler, erreurs à éviter…">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={field} />
      </Section>

      <Section title="Photos">
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((i) => i.key !== img.key))}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1"
                aria-label="Retirer la photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {images.length < 12 && (
            <button type="button" disabled={uploading} onClick={() => imagesInput.current?.click()} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-muted">
              <ImagePlus size={20} />
            </button>
          )}
        </div>
        {uploading && <p className="mt-2 text-xs text-gold">Envoi de l&apos;image…</p>}
        <input ref={imagesInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Photos" onChange={(e) => (addImages(e.target.files, false), (e.target.value = ""))} />
      </Section>

      <Section title="Liens">
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={l.label}
                onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                placeholder="Titre (ex. Compte exemple)"
                className={`${field} w-2/5`}
              />
              <input
                value={l.url}
                onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://…"
                inputMode="url"
                className={field}
              />
              <button type="button" onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 px-2 text-muted" aria-label="Retirer le lien">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {links.length < 10 && (
            <button type="button" onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted">
              <Plus size={16} /> Ajouter un lien
            </button>
          )}
        </div>
      </Section>

      <Section title="Visibilité">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Visible par les élèves</span>
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
        </label>
        {initial.id && (
          <div className="mt-4 border-t border-line pt-4">
            {initial.chosenBy > 0 ? (
              <p className="text-xs text-muted">
                Choisie par {initial.chosenBy} élève{initial.chosenBy > 1 ? "s" : ""} : elle ne peut pas être supprimée, seulement masquée.
              </p>
            ) : (
              <button type="button" onClick={remove} className="text-sm text-danger underline">
                Supprimer cette fiche
              </button>
            )}
          </div>
        )}
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card-2/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className={`flex-1 text-sm ${message ? (message.ok ? "text-success" : "text-danger") : "text-muted"}`}>{message?.text ?? c.label}</p>
          <button onClick={save} disabled={pending || uploading} className="rounded-2xl bg-text px-6 py-3 text-sm font-semibold text-black disabled:opacity-40">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Choices<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? null : o.value)}
          className={`rounded-full border px-4 py-2 text-sm ${value === o.value ? "border-gold bg-gold/15 text-gold" : "border-line text-muted"}`}
        >
          {o.label}
        </button>
      ))}
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
