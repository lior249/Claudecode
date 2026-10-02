"use client";

import { useRef, useState } from "react";
import { FileAudio, FileVideo, Upload, X } from "lucide-react";

// Composant d'envoi réutilisable : glisser-déposer ou sélection, contrôles (format, poids, durée),
// barre de progression, aperçu, suppression avant soumission. Le serveur revérifie tout.

const LIMITS = { maxBytes: 200 * 1024 * 1024, maxSeconds: 150 };
const FORMATS = {
  video: { ext: [".mp4", ".mov", ".webm"], accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm", label: "MP4, MOV" },
  audio: { ext: [".mp3", ".wav", ".m4a", ".aac"], accept: "audio/*,.mp3,.wav,.m4a,.aac", label: "MP3, M4A, WAV" },
};

export interface UploadedAsset {
  id: string;
  originalName: string;
  sizeBytes: number;
  durationSeconds: number | null;
}

type State =
  | { step: "idle" }
  | { step: "uploading"; name: string; progress: number }
  | { step: "done"; asset: UploadedAsset; previewUrl: string };

function readDuration(file: File, kind: "video" | "audio"): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null); // format non lisible par le navigateur : le serveur vérifiera
    setTimeout(() => done(null), 5000);
    el.src = url;
  });
}

export function UploadDropzone({
  lessonId,
  kind,
  onChange,
}: {
  lessonId: string;
  kind: "video" | "audio";
  onChange: (asset: UploadedAsset | null) => void;
}) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const f = FORMATS[kind];

  async function handle(file: File) {
    setError(null);
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!f.ext.includes(ext)) return setError(`Format non accepté. Formats possibles : ${f.label}.`);
    if (file.size > LIMITS.maxBytes) return setError("Fichier trop lourd : 200 Mo maximum.");
    const duration = await readDuration(file, kind);
    if (duration !== null && duration > LIMITS.maxSeconds + 0.5) return setError("Trop long : 2 min 30 maximum.");

    setState({ step: "uploading", name: file.name, progress: 0 });
    const req = new XMLHttpRequest();
    xhr.current = req;
    req.open("POST", `/api/lessons/${lessonId}/uploads`);
    req.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    req.upload.onprogress = (e) => e.lengthComputable && setState({ step: "uploading", name: file.name, progress: e.loaded / e.total });
    req.onload = () => {
      let body: { asset?: UploadedAsset; error?: string } = {};
      try {
        body = JSON.parse(req.responseText);
      } catch {}
      if (req.status === 200 && body.asset) {
        setState({ step: "done", asset: body.asset, previewUrl: URL.createObjectURL(file) });
        onChange(body.asset);
      } else {
        setState({ step: "idle" });
        setError(body.error ?? "Impossible d'envoyer ton fichier pour le moment. Réessaie.");
      }
    };
    req.onerror = () => {
      setState({ step: "idle" });
      setError("Connexion interrompue. Vérifie ton réseau et réessaie.");
    };
    req.send(file);
  }

  function reset() {
    xhr.current?.abort();
    if (state.step === "done") URL.revokeObjectURL(state.previewUrl);
    setState({ step: "idle" });
    onChange(null);
  }

  const Icon = kind === "video" ? FileVideo : FileAudio;

  if (state.step === "done") {
    return (
      <div className="rounded-2xl border border-line bg-card p-3">
        {kind === "video" ? (
          <video src={state.previewUrl} controls playsInline className="max-h-80 w-full rounded-xl bg-black" />
        ) : (
          <audio src={state.previewUrl} controls className="w-full" />
        )}
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Icon size={16} className="text-muted" />
          <span className="min-w-0 flex-1 truncate">{state.asset.originalName}</span>
          <button onClick={reset} className="flex items-center gap-1 rounded-full bg-card-2 px-3 py-1.5 text-xs text-muted">
            <X size={12} /> Retirer
          </button>
        </div>
      </div>
    );
  }

  if (state.step === "uploading") {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          <Icon size={16} className="text-muted" />
          <span className="min-w-0 flex-1 truncate">{state.name}</span>
          <span className="text-muted">{Math.round(state.progress * 100)} %</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-card-2">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${state.progress * 100}%` }} />
        </div>
        <button onClick={reset} className="mt-3 text-xs text-muted underline">
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handle(file);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-gold bg-gold/10" : "border-line bg-card"
        }`}
      >
        <Upload className="text-muted" />
        <span className="font-medium">{kind === "video" ? "Choisir ma vidéo" : "Choisir mon audio"}</span>
        <span className="text-xs text-muted">{f.label} · 200 Mo et 2 min 30 maximum</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={f.accept}
        className="hidden"
        aria-label={kind === "video" ? "Fichier vidéo" : "Fichier audio"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handle(file);
        }}
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
