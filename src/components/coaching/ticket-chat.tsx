"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Lock, Send, X } from "lucide-react";
import type { TicketView } from "@/server/coaching/tickets";
import { ackAdviceAction, closeTicketAction, outcomeAction, postMessageAction, rateTicketAction } from "@/app/actions/coaching";
import { uploadImage } from "./image-upload";
import { LocalTime } from "@/components/local-time";

const time = (iso: string) => <LocalTime iso={iso} />;
const FOLLOW_UPS = [
  { value: 24, label: "24 h" },
  { value: 48, label: "48 h" },
  { value: 72, label: "72 h" },
  { value: 120, label: "5 jours" },
];

// Rend les liens cliquables dans un message.
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else setError(res.error ?? "Erreur.");
    });
  return { pending, error, run, setError };
}

export function TicketChat({ ticket }: { ticket: TicketView }) {
  const isLearner = ticket.viewerIs === "LEARNER";
  const isCoach = ticket.viewerIs === "COACH";
  const open = ticket.status === "OPEN";
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView(), [ticket.messages.length]);

  return (
    <div className="space-y-3">
      {ticket.dueAt && open && <DueBanner dueAt={ticket.dueAt} isCoach={isCoach} />}
      <ul className="space-y-3">
        {ticket.messages.map((m) => {
          const mine = (m.fromCoach && isCoach) || (!m.fromCoach && isLearner);
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm ${m.kind !== "TEXT" ? "border border-gold/40 bg-gold/10" : mine ? "bg-text text-black" : "bg-card"}`}>
                <p className={`mb-1 text-xs ${mine && m.kind === "TEXT" ? "text-black/60" : "text-muted"}`}>
                  {m.author}
                  {m.fromCoach ? " · coach" : ""} · {time(m.createdAt)}
                </p>
                <p className="whitespace-pre-line">
                  <Linkified text={m.body} />
                </p>
                {m.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {m.images.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.fromCoach && m.followUpHours && <p className="mt-1 text-xs opacity-70">Retour attendu sous {m.followUpHours < 120 ? `${m.followUpHours} h` : "5 jours"}</p>}
                {isLearner && open && m.fromCoach && <AdviceControls message={m} />}
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={bottom} />

      {open ? (
        <Composer ticketId={ticket.id} isCoach={isCoach} canWrite={isLearner || isCoach} />
      ) : (
        <div className="rounded-3xl border border-line bg-card p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Lock size={14} /> Ticket clôturé{ticket.closedAt ? ` le ${time(ticket.closedAt)}` : ""}
          </p>
          {ticket.origin === "LEARNER" && (ticket.rating ? <RatingDone rating={ticket.rating} comment={ticket.ratingComment} /> : isLearner && <RatingForm ticketId={ticket.id} />)}
        </div>
      )}
      {isCoach && open && <CloseButton ticketId={ticket.id} />}
    </div>
  );
}

function DueBanner({ dueAt, isCoach }: { dueAt: string; isCoach: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = new Date(dueAt).getTime() - now;
  const h = Math.floor(Math.abs(left) / 3_600_000);
  const m = Math.floor((Math.abs(left) % 3_600_000) / 60_000);
  const late = left < 0;
  return (
    <p className={`rounded-2xl px-4 py-2 text-center text-sm ${late ? "bg-danger/15 text-danger" : left < 4 * 3_600_000 ? "bg-gold/15 text-gold" : "bg-card text-muted"}`}>
      {late
        ? `Réponse en retard de ${h} h ${String(m).padStart(2, "0")}`
        : isCoach
          ? `Il te reste ${h} h ${String(m).padStart(2, "0")} pour répondre`
          : `Ton coach répond sous ${h} h ${String(m).padStart(2, "0")} maximum`}
    </p>
  );
}

function AdviceControls({ message }: { message: TicketView["messages"][number] }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"none" | "bad">("none");
  const [comment, setComment] = useState("");
  if (!message.acknowledgedAt) {
    return (
      <div className="mt-2">
        <button disabled={pending} onClick={() => run(() => ackAdviceAction({ messageId: message.id }))} className="rounded-xl bg-success px-3 py-2 text-xs font-semibold text-black">
          Conseil reçu, je l&apos;applique
        </button>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
    );
  }
  if (message.outcome) return <p className="mt-2 text-xs opacity-70">{message.outcome === "WORKED" ? "👍 Ça a marché" : "👎 Ça n'a pas marché"}</p>;
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs opacity-70">Alors, ça a marché ?</p>
      {mode === "bad" ? (
        <>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Qu'est-ce qui n'a pas marché ?" className="w-full rounded-xl border border-line bg-bg p-2 text-xs text-text" />
          <button disabled={pending} onClick={() => run(() => outcomeAction({ messageId: message.id, worked: false, comment }))} className="rounded-xl bg-danger px-3 py-2 text-xs font-semibold text-white">
            Envoyer
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => run(() => outcomeAction({ messageId: message.id, worked: true, comment: "" }))} className="rounded-xl bg-success px-3 py-2 text-xs font-semibold text-black">
            👍 Ça a marché
          </button>
          <button onClick={() => setMode("bad")} className="rounded-xl bg-danger/80 px-3 py-2 text-xs font-semibold text-white">
            👎 Ça n&apos;a pas marché
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function Composer({ ticketId, isCoach, canWrite }: { ticketId: string; isCoach: boolean; canWrite: boolean }) {
  const { pending, error, run, setError } = useAction();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<{ key: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [followUp, setFollowUp] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!canWrite) return null;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 4 - images.length)) {
        const img = await uploadImage(f);
        setImages((prev) => [...prev, img].slice(0, 4));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="sticky bottom-3 space-y-2 rounded-3xl border border-line bg-card-2 p-3 shadow-2xl">
      {images.length > 0 && (
        <div className="flex gap-2">
          {images.map((img) => (
            <span key={img.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <button onClick={() => setImages((p) => p.filter((x) => x.key !== img.key))} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5" aria-label="Retirer l'image">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Ton message (texte, liens)…" className="w-full resize-none rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold" />
      {isCoach && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Retour attendu :</span>
          {FOLLOW_UPS.map((f) => (
            <button key={f.value} onClick={() => setFollowUp(followUp === f.value ? null : f.value)} className={`rounded-full border px-2.5 py-1 ${followUp === f.value ? "border-gold bg-gold/15 text-gold" : "border-line text-muted"}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button disabled={uploading || images.length >= 4} onClick={() => input.current?.click()} className="rounded-xl bg-card p-2.5 text-muted" aria-label="Ajouter une image">
          <ImagePlus size={18} />
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="Image du message" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <span className="flex-1 text-xs text-muted">{uploading ? "Envoi de l'image…" : "Images et liens acceptés, pas de vidéo."}</span>
        <button
          disabled={pending || uploading || (!body.trim() && !images.length)}
          onClick={() =>
            run(() => postMessageAction({ ticketId, body, imageKeys: images.map((i) => i.key), followUpHours: followUp }), () => {
              setBody("");
              setImages([]);
              setFollowUp(null);
            })
          }
          className="flex items-center gap-1.5 rounded-xl bg-text px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          <Send size={14} /> Envoyer
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function CloseButton({ ticketId }: { ticketId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="text-center">
      <button disabled={pending} onClick={() => window.confirm("Clôturer ce ticket ?") && run(() => closeTicketAction({ ticketId }))} className="rounded-2xl border border-line px-5 py-3 text-sm">
        Clôturer le ticket
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

const RATINGS = [
  { value: "BAD", emoji: "😞", label: "Pas satisfait", tone: "border-danger bg-danger/15" },
  { value: "NEUTRAL", emoji: "😐", label: "Moyen", tone: "border-line bg-card-2" },
  { value: "GOOD", emoji: "🙂", label: "Satisfait", tone: "border-success bg-success/15" },
] as const;

function RatingForm({ ticketId }: { ticketId: string }) {
  const { pending, error, run } = useAction();
  const [rating, setRating] = useState<"BAD" | "NEUTRAL" | "GOOD" | null>(null);
  const [comment, setComment] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <p>Qu&apos;as-tu pensé de la réponse de ton coach ?</p>
      <div className="grid grid-cols-3 gap-2">
        {RATINGS.map((r) => (
          <button key={r.value} onClick={() => setRating(r.value)} className={`rounded-2xl border p-3 text-center ${rating === r.value ? r.tone : "border-line"}`}>
            <span className="block text-3xl">{r.emoji}</span>
            <span className="text-xs">{r.label}</span>
          </button>
        ))}
      </div>
      {rating && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={rating === "GOOD" ? "Un mot pour ton coach (facultatif)" : "Explique pourquoi (obligatoire)"}
            className="w-full rounded-xl border border-line bg-bg p-2 text-sm"
          />
          <button disabled={pending} onClick={() => run(() => rateTicketAction({ ticketId, rating, comment }))} className="w-full rounded-2xl bg-text py-3 text-sm font-semibold text-black">
            Envoyer mon avis
          </button>
        </>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function RatingDone({ rating, comment }: { rating: string; comment: string | null }) {
  const r = RATINGS.find((x) => x.value === rating);
  return (
    <p className="mt-2 text-sm text-muted">
      Avis de l&apos;élève : {r?.emoji} {r?.label}
      {comment ? ` — « ${comment} »` : ""}
    </p>
  );
}
