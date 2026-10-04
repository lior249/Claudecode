"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import { createResultAction } from "@/app/actions/results";
import { uploadImage } from "@/components/coaching/image-upload";

const field = "w-full rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";

// Envoi d'un résultat d'un type donné : capture (avec le code du jour), titre, petit texte, lien facultatif.
export function ResultForm({ typeId, dailyCode }: { typeId: string; dailyCode: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [img, setImg] = useState<{ key: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="grid gap-3 rounded-3xl border border-line bg-card p-4 lg:p-5">
      <h2 className="font-semibold">Ta capture</h2>
      <p className="text-sm text-muted">
        Écris ton code du jour <b className="rounded-md bg-gold/15 px-1.5 py-0.5 font-mono text-gold">{dailyCode}</b> sur la capture (dessin, texte ajouté…), puis envoie-la.
      </p>
      {img ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt="" className="h-24 w-24 rounded-xl object-cover" />
          <button onClick={() => setImg(null)} className="text-sm text-muted underline">
            Changer la capture
          </button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => input.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-6 text-sm text-muted hover:text-text">
          <ImagePlus size={18} /> {busy ? "Envoi…" : "Ajouter la capture"}
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
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="Titre (ex. : 634 000 vues sur une seule vidéo)" className={field} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1500} placeholder="Raconte : ce que tu ressens, comment tu y es arrivé…" className={field} />
      <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" placeholder="Lien (facultatif) : https://…" className={field} />
      <p className="text-xs text-muted">
        L&apos;IA vérifie ta capture : si elle est conforme, ton résultat est publié tout de suite avec ses points. Sinon, ton coach la vérifie. Visible par tous les membres, 2 résultats par jour au maximum.
      </p>
      <button
        disabled={pending || busy || title.trim().length < 3 || !img}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createResultAction({ typeId, title, body, imageKey: img!.key, link: link || undefined });
            if (!res.ok) return setError(res.error);
            router.push("/resultats/mes-resultats?envoye=1");
          })
        }
        className="rounded-2xl bg-text py-3.5 font-semibold text-black disabled:opacity-40"
      >
        {pending ? "Envoi…" : "Envoyer mon résultat"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
