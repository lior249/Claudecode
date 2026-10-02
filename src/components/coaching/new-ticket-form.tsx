"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { openTicketAction } from "@/app/actions/coaching";
import { uploadImage } from "./image-upload";

const field = "w-full rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

export function NewTicketForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<{ key: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - images.length)) {
        const img = await uploadImage(f);
        setImages((p) => [...p, img].slice(0, 4));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
      <label className="block text-sm text-muted">
        Sujet
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Ex. : mes vues ont chuté" className={`${field} mt-1 text-text`} />
      </label>
      <label className="block text-sm text-muted">
        Ta demande
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Explique ta situation. Tu peux coller des liens." className={`${field} mt-1 text-text`} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {images.map((img) => (
          <span key={img.key} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
            <button onClick={() => setImages((p) => p.filter((x) => x.key !== img.key))} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5" aria-label="Retirer l'image">
              <X size={12} />
            </button>
          </span>
        ))}
        {images.length < 4 && (
          <button disabled={uploading} onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-card-2 px-3 py-2 text-sm">
            <ImagePlus size={16} /> {uploading ? "Envoi…" : "Ajouter une capture"}
          </button>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="Capture" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      </div>
      <p className="text-xs text-muted">Ton coach a 12 h pour te répondre. Pas de vidéo ni d&apos;audio : des images et des liens.</p>
      <button
        disabled={pending || uploading || !subject.trim() || !body.trim()}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await openTicketAction({ subject, body, imageKeys: images.map((i) => i.key) });
            if (res.ok && res.id) router.push(`/coaching/tickets/${res.id}`);
            else if (!res.ok) setError(res.error);
          })
        }
        className="w-full rounded-2xl bg-text py-4 font-semibold text-black disabled:opacity-40"
      >
        {pending ? "Envoi…" : "Envoyer à mon coach"}
      </button>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
