"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { removeOnboardingVideoAction } from "@/app/actions/onboarding";

// Vidéo de l'étape 1 de l'accueil : envoyer, remplacer, retirer.
export function OnboardingVideoEditor({ current }: { current: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const send = (file: File) => {
    setMessage(null);
    setProgress(0);
    const req = new XMLHttpRequest();
    req.open("POST", "/api/admin/onboarding-video");
    req.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    req.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
    req.onload = () => {
      setProgress(null);
      let body: { name?: string; error?: string } = {};
      try {
        body = JSON.parse(req.responseText);
      } catch {}
      if (req.status === 200) {
        setMessage({ ok: true, text: "Vidéo enregistrée." });
        router.refresh();
      } else setMessage({ ok: false, text: body.error ?? "Envoi impossible. Réessaie." });
    };
    req.onerror = () => {
      setProgress(null);
      setMessage({ ok: false, text: "Connexion interrompue. Réessaie." });
    };
    req.send(file);
  };

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-card p-4 lg:p-5">
      {current ? (
        <>
          <video src={`/api/onboarding-video?v=${encodeURIComponent(current)}`} controls playsInline preload="metadata" className="aspect-video w-full max-w-3xl rounded-2xl bg-black" />
          <p className="text-sm text-muted">Fichier : {current}</p>
        </>
      ) : (
        <p className="text-sm text-muted">Aucune vidéo pour l&apos;instant : l&apos;étape 1 affiche seulement un texte de bienvenue.</p>
      )}
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-card-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={progress !== null} onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-2xl bg-text px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">
          <Upload size={16} /> {current ? "Remplacer la vidéo" : "Envoyer la vidéo"}
        </button>
        {current && (
          <button
            disabled={pending || progress !== null}
            onClick={() => window.confirm("Retirer la vidéo d'accueil ?") && start(async () => void (await removeOnboardingVideoAction(), router.refresh()))}
            className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-sm text-danger"
          >
            <Trash2 size={16} /> Retirer
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        aria-label="Vidéo d'accueil"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) send(f);
        }}
      />
      <p className="text-xs text-muted">MP4, MOV ou WebM, 500 Mo maximum.</p>
      {message && <p className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>{message.text}</p>}
    </section>
  );
}
