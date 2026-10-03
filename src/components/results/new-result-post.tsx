"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { createResultPostAction } from "@/app/actions/results";
import { uploadImage } from "@/components/coaching/image-upload";

const field = "w-full rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

// Publier un résultat : titre, capture, petit texte, lien facultatif. Validé ensuite par le coach (ou l'admin).
export function NewResultPost({ autoApproved }: { autoApproved: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [img, setImg] = useState<{ key: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  if (!open)
    return (
      <button onClick={() => (setOpen(true), setDone(null))} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted">
        <Plus size={16} /> Publier un résultat
        {done && <span className="text-success">· {done}</span>}
      </button>
    );

  return (
    <section className="grid gap-2 rounded-3xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Publier un résultat</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="Titre (ex. : 1 500 € en une seule vidéo 🔥)" className={field} />
      {img ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <button onClick={() => setImg(null)} className="text-xs text-muted underline">
            Changer la capture
          </button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => input.current?.click()} className="flex items-center gap-1.5 justify-self-start rounded-xl bg-card-2 px-3 py-2 text-sm">
          <ImagePlus size={16} /> {busy ? "Envoi…" : "Ajouter la capture"}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Capture du résultat"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            setImg(await uploadImage(f));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1500} placeholder="Raconte : ce que tu ressens, comment tu y es arrivé…" className={field} />
      <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="Lien (facultatif) : https://…" className={field} />
      <p className="text-xs text-muted">
        {autoApproved ? "Ton post est publié tout de suite." : "Ton post est publié une fois validé."} 2 posts par jour au maximum. Il sera visible par tous les membres.
      </p>
      <div className="flex gap-2">
        <button
          disabled={pending || busy || title.trim().length < 3 || !img}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await createResultPostAction({ title, body, imageKey: img!.key, link: link || undefined });
              if (!res.ok) return setError(res.error);
              setTitle("");
              setBody("");
              setLink("");
              setImg(null);
              setOpen(false);
              setDone(autoApproved ? "Publié !" : "Envoyé pour validation.");
              router.refresh();
            })
          }
          className="flex-1 rounded-2xl bg-text py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          Publier
        </button>
        <button onClick={() => setOpen(false)} className="rounded-2xl bg-card-2 px-4 text-sm">
          Annuler
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
