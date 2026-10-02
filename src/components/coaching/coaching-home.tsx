"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ChevronRight, ExternalLink, ImagePlus, Lock, MessageCircle, Plus, Snowflake, Trophy } from "lucide-react";
import type { CoachingDashboard } from "@/server/coaching/progress";
import {
  addPostAction,
  followersProofAction,
  monthlyProofAction,
  reactivationAction,
  saveProfileAction,
  viewProofAction,
} from "@/app/actions/coaching";
import { RankBadge } from "@/components/learn/badges";
import { AccountBar } from "@/components/profile/account-bar";
import type { MenuUser } from "@/components/profile/user-menu";
import { Flame } from "./flame";
import { uploadImage } from "./image-upload";

interface TicketRow {
  id: string;
  subject: string;
  origin: "LEARNER" | "COACH";
  status: "OPEN" | "CLOSED";
  needsRating: boolean;
  waitingCoach: boolean;
  lastMessageAt: string;
}

const frDay = (day: string) => day.split("-").reverse().join("/");
const field = "w-full rounded-2xl border border-line bg-bg p-3 text-sm outline-none focus:border-gold";
const card = "rounded-3xl border border-line bg-card p-5";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, onOk?: () => void) =>
    start(async () => {
      setError(null);
      setDone(null);
      const res = await fn();
      if (res.ok) {
        setDone(success);
        onOk?.();
        router.refresh();
      } else setError(res.error ?? "Erreur.");
    });
  return { pending, error, done, run };
}

export function CoachingHome({
  name,
  dashboard: d,
  tickets,
  canOpenTicket,
  maxTickets,
  account,
}: {
  name: string;
  dashboard: CoachingDashboard;
  tickets: TicketRow[];
  canOpenTicket: boolean;
  maxTickets: number;
  account: { user: MenuUser; unread: number };
}) {
  return (
    <>
      <header className="flex items-center justify-between py-5">
        <Link href="/learn" className="logo text-3xl">
          Creato
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/classement" className="rounded-full bg-card p-2" aria-label="Classement">
            <Trophy size={16} className="text-gold" />
          </Link>
          <AccountBar user={account.user} unread={account.unread} />
        </div>
      </header>

      <section className={card}>
        <div className="flex items-center gap-4">
          <RankBadge rank={d.rank} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{name}</p>
            <p className="text-sm text-muted">Coach : {d.coachName ?? "en cours d'attribution"}</p>
          </div>
          <Flame level={d.streak.flame} days={d.streak.current} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Points" value={d.points.total} />
          <Stat label="Record" value={`${d.streak.best} j`} />
          <Stat label="Qualité" value={d.points.quality} />
        </div>
        {d.streak.frozenDays.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-sky-300">
            <Snowflake size={12} /> Gel utilisé le {frDay(d.streak.frozenDays.at(-1)!)} : ta chaîne est sauvée.
          </p>
        )}
      </section>

      {d.status === "REVOKED" && <Reactivation pending={d.reactivation?.status === "PENDING"} />}
      {d.status === "COMPLETED" && (
        <section className={`${card} mt-4 border-gold/50 text-center`}>
          <p className="text-4xl">🏆</p>
          <p className="mt-2 text-lg font-semibold">Coaching terminé : rang SSS !</p>
          <p className="text-sm text-muted">Tu as atteint 1 000 € en un mois. Bravo !</p>
        </section>
      )}

      {d.status === "ACTIVE" && (
        <div className="mt-4 space-y-4">
          {!d.tiktokUsername || !d.timezone ? (
            <Profile username={d.tiktokUsername} />
          ) : (
            <TodayPost todayDone={d.streak.todayDone} username={d.tiktokUsername} />
          )}

          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Mes échanges avec mon coach</h2>
              {canOpenTicket ? (
                <Link href="/coaching/tickets/new" className="flex items-center gap-1 rounded-xl bg-text px-3 py-2 text-xs font-semibold text-black">
                  <Plus size={14} /> Nouvelle demande
                </Link>
              ) : (
                <span className="text-xs text-muted">{maxTickets} demandes en cours (max.)</span>
              )}
            </div>
            {tickets.length === 0 && <p className="text-sm text-muted">Aucun échange pour l&apos;instant.</p>}
            <ul className="divide-y divide-line">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/coaching/tickets/${t.id}`} className="flex items-center gap-3 py-3">
                    {t.status === "OPEN" ? <MessageCircle size={18} className={t.origin === "COACH" ? "text-gold" : "text-text"} /> : <Lock size={16} className="text-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.subject}</span>
                      <span className="block text-xs text-muted">
                        {t.origin === "COACH" ? "Question de ton coach" : "Ta demande"}
                        {t.status === "CLOSED" ? " · clôturé" : t.waitingCoach ? " · en attente du coach" : " · le coach a répondu"}
                      </span>
                    </span>
                    {t.needsRating && <span className="rounded-full bg-gold/15 px-2 py-1 text-xs text-gold">Donne ton avis</span>}
                    <ChevronRight size={16} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <Videos posts={d.posts} />
          <Ranks dashboard={d} />
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Profile({ username }: { username: string | null }) {
  const { pending, error, run } = useAction();
  const [tiktok, setTiktok] = useState(username ?? "");
  // Fuseau du téléphone de l'élève (lu dans le navigateur).
  const [tz] = useState(() => (typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
  return (
    <section className={`${card} border-gold/40`}>
      <h2 className="font-semibold">Avant de commencer</h2>
      <p className="mt-1 text-sm text-muted">Ton compte TikTok sert à vérifier tes posts. Ton fuseau horaire sert à compter tes jours de streak.</p>
      <label className="mt-3 block text-sm text-muted">
        Ton nom d&apos;utilisateur TikTok
        <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@ton_compte" className={`${field} mt-1 text-text`} />
      </label>
      <p className="mt-2 text-xs text-muted" suppressHydrationWarning>
        Fuseau horaire détecté : {tz}
      </p>
      <button disabled={pending || !tiktok.trim()} onClick={() => run(() => saveProfileAction({ tiktokUsername: tiktok, timezone: tz }), "Enregistré.")} className="mt-3 w-full rounded-2xl bg-text py-3 font-semibold text-black disabled:opacity-40">
        Enregistrer
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

function TodayPost({ todayDone, username }: { todayDone: boolean; username: string }) {
  const { pending, error, done, run } = useAction();
  const [url, setUrl] = useState("");
  return (
    <section className={`${card} ${todayDone ? "border-success/40" : "border-orange-500/50"}`}>
      <h2 className="font-semibold">{todayDone ? "🔥 Post du jour validé" : "🔥 Ton post du jour"}</h2>
      <p className="mt-1 text-sm text-muted">
        {todayDone ? "Ta chaîne continue. Tu peux ajouter d'autres posts." : "Au moins 1 post par jour pour garder ta flamme. Colle le lien de ta vidéo."}
      </p>
      <div className="mt-3 flex gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://www.tiktok.com/@${username}/video/…`} inputMode="url" className={field} />
        <button disabled={pending || !url.trim()} onClick={() => run(() => addPostAction({ url }), "Post ajouté !", () => setUrl(""))} className="shrink-0 rounded-2xl bg-text px-4 text-sm font-semibold text-black disabled:opacity-40">
          Ajouter
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {done && <p className="mt-2 text-sm text-success">{done}</p>}
    </section>
  );
}

function ImagePicker({ value, onChange, label }: { value: { key: string; url: string } | null; onChange: (v: { key: string; url: string } | null) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          <button onClick={() => onChange(null)} className="text-xs text-muted underline">
            Changer
          </button>
        </div>
      ) : (
        <button disabled={busy} onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-card-2 px-3 py-2 text-sm">
          <ImagePlus size={16} /> {busy ? "Envoi…" : label}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setError(null);
          try {
            onChange(await uploadImage(f));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function Videos({ posts }: { posts: CoachingDashboard["posts"] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className={card}>
      <h2 className="font-semibold">Mes vidéos</h2>
      <p className="mt-1 text-xs text-muted">Points qualité : 10 000 vues = 1 · 100 000 = 2 · 300 000 = 3 · 500 000 = 4 · 1 million = 5.</p>
      {posts.length === 0 && <p className="mt-3 text-sm text-muted">Ajoute ton premier post ci-dessus.</p>}
      <ul className="mt-2 divide-y divide-line">
        {posts.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-24 text-muted">{frDay(p.localDate)}</span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 truncate underline">
                Voir <ExternalLink size={12} />
              </a>
              <span className="text-xs text-muted">{p.validatedViews ? `${p.validatedViews.toLocaleString("fr-FR")} vues · ${p.points} pt` : ""}</span>
              {p.pendingProof ? (
                <span className="text-xs text-gold">En validation</span>
              ) : (
                <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="rounded-lg bg-card-2 px-2 py-1 text-xs">
                  Mes vues
                </button>
              )}
            </div>
            {openId === p.id && <ViewProofForm postId={p.id} onDone={() => setOpenId(null)} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ViewProofForm({ postId, onDone }: { postId: string; onDone: () => void }) {
  const { pending, error, run } = useAction();
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [img, setImg] = useState<{ key: string; url: string } | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "");
  return (
    <div className="mt-2 space-y-2 rounded-2xl bg-bg/40 p-3">
      <p className="text-xs text-muted">Recopie les chiffres affichés sur ta capture : ton coach vérifie qu&apos;ils concordent avec la vidéo.</p>
      <input value={views} onChange={(e) => setViews(digits(e.target.value))} inputMode="numeric" placeholder="Vues" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input value={likes} onChange={(e) => setLikes(digits(e.target.value))} inputMode="numeric" placeholder="J'aime" className={field} />
        <input value={comments} onChange={(e) => setComments(digits(e.target.value))} inputMode="numeric" placeholder="Commentaires" className={field} />
      </div>
      <ImagePicker value={img} onChange={setImg} label="Capture des statistiques" />
      <button
        disabled={pending || !views || !likes || !comments || !img}
        onClick={() =>
          run(() => viewProofAction({ postId, views: Number(views), likes: Number(likes), comments: Number(comments), imageKey: img!.key }), "Envoyé.", onDone)
        }
        className="w-full rounded-xl bg-text py-2.5 text-sm font-semibold text-black disabled:opacity-40"
      >
        Envoyer à mon coach
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function VideoLinks({ value, onChange, username }: { value: string[]; onChange: (v: string[]) => void; username: string | null }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Liens des vidéos qui ont rapporté ces gains (1 à 10).</p>
      {value.map((url, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={url}
            onChange={(e) => onChange(value.map((u, j) => (j === i ? e.target.value : u)))}
            inputMode="url"
            placeholder={`https://www.tiktok.com/@${username ?? "ton_compte"}/video/…`}
            className={field}
          />
          {value.length > 1 && (
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="shrink-0 rounded-xl bg-card-2 px-3 text-xs text-muted" aria-label="Retirer ce lien">
              ✕
            </button>
          )}
        </div>
      ))}
      {value.length < 10 && (
        <button onClick={() => onChange([...value, ""])} className="flex items-center gap-1 text-xs text-muted underline">
          <Plus size={12} /> Ajouter un lien
        </button>
      )}
    </div>
  );
}

const PROOF_STATUS: Record<string, string> = { PENDING: "en validation", APPROVED: "validé ✅", REJECTED: "refusé" };

function Ranks({ dashboard: d }: { dashboard: CoachingDashboard }) {
  const followers = useAction();
  const monthly = useAction();
  const [followersCount, setFollowersCount] = useState("");
  const [amount, setAmount] = useState("");
  const [fImg, setFImg] = useState<{ key: string; url: string } | null>(null);
  const [mImg, setMImg] = useState<{ key: string; url: string } | null>(null);
  const [links, setLinks] = useState<string[]>([""]);
  const filledLinks = links.map((l) => l.trim()).filter(Boolean);
  const hasA = ["A", "S", "SS", "SSS"].includes(d.rank);
  return (
    <section className={card}>
      <h2 className="font-semibold">Mes rangs</h2>
      <p className="mt-1 text-xs text-muted">A : 10 000 abonnés · S : un mois à 100 € · SS : un mois à 500 € · SSS : un mois à 1 000 € (fin du coaching).</p>

      {!hasA && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Rang A : 10 000 abonnés</p>
          <input value={followersCount} onChange={(e) => setFollowersCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Nombre d'abonnés" className={field} />
          <ImagePicker value={fImg} onChange={setFImg} label="Capture de ton profil (nom visible)" />
          <button
            disabled={followers.pending || !followersCount || !fImg}
            onClick={() => followers.run(() => followersProofAction({ followers: Number(followersCount), imageKey: fImg!.key }), "Envoyé à ton coach.")}
            className="w-full rounded-xl bg-text py-2.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Envoyer
          </button>
          {followers.error && <p className="text-xs text-danger">{followers.error}</p>}
          {followers.done && <p className="text-xs text-success">{followers.done}</p>}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-line pt-4">
        <p className="text-sm font-medium">Résultats du mois</p>
        {d.monthlyWindow.open && !d.monthlyAlreadySent ? (
          <>
            <p className="text-xs text-muted">
              Mois de {d.monthlyWindow.month} : envoie ce que tu as gagné, la capture de ton tableau de bord et les liens des vidéos. Ton coach vérifie que tout concorde avant de valider.
            </p>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Montant gagné (€)" className={field} />
            <ImagePicker value={mImg} onChange={setMImg} label="Capture du tableau de bord" />
            <VideoLinks value={links} onChange={setLinks} username={d.tiktokUsername} />
            <p className="text-xs text-muted">Une fois validés, tes résultats du mois et ton meilleur mois sont visibles par tous les membres dans le classement (jamais tes captures ni tes vidéos).</p>
            <button
              disabled={monthly.pending || !amount || !mImg || filledLinks.length === 0}
              onClick={() => monthly.run(() => monthlyProofAction({ amountEur: Number(amount), videoUrls: filledLinks, imageKey: mImg!.key }), "Résultats envoyés.")}
              className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Envoyer mes résultats
            </button>
            {monthly.error && <p className="text-xs text-danger">{monthly.error}</p>}
          </>
        ) : (
          <p className="text-xs text-muted">{d.monthlyAlreadySent ? "Résultats du mois envoyés." : "Disponible du dernier jour du mois au 5 du mois suivant."}</p>
        )}
      </div>

      {d.proofs.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
          {d.proofs.map((p) => (
            <li key={p.id}>
              {p.kind === "MONTHLY" ? `Résultats ${p.month} : ${p.amountEur} €` : `${p.followers?.toLocaleString("fr-FR")} abonnés`} — {PROOF_STATUS[p.status]}
              {p.reviewComment ? ` (${p.reviewComment})` : ""}
              {p.videoUrls.length > 0 && ` · ${p.videoUrls.length} vidéo${p.videoUrls.length > 1 ? "s" : ""}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Reactivation({ pending: alreadyPending }: { pending: boolean }) {
  const { pending, error, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <section className={`${card} mt-4 border-danger/50`}>
      <h2 className="font-semibold">Ton coaching est en pause</h2>
      <p className="mt-1 text-sm text-muted">Tu n&apos;as pas posté pendant 15 jours : ta place et le rôle @Élite ont été retirés.</p>
      {alreadyPending ? (
        <p className="mt-3 text-sm text-gold">Ta demande de réactivation est en cours d&apos;examen.</p>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Explique la raison de ton absence…" className={`${field} mt-3`} />
          <button disabled={pending || reason.trim().length < 20} onClick={() => run(() => reactivationAction({ reason }), "Demande envoyée.")} className="mt-2 w-full rounded-2xl bg-text py-3 font-semibold text-black disabled:opacity-40">
            Réactiver mon coaching
          </button>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </>
      )}
    </section>
  );
}
