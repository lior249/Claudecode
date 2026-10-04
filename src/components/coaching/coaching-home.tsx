"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronRight, ExternalLink, Lock, MessageCircle, Plus, Snowflake } from "lucide-react";
import type { CoachingDashboard } from "@/server/coaching/progress";
import { addPostAction, reactivationAction, saveProfileAction } from "@/app/actions/coaching";
import { RankBadge } from "@/components/learn/badges";
import { AccountBar } from "@/components/profile/account-bar";
import type { MenuUser } from "@/components/profile/user-menu";
import { Flame } from "./flame";
import { TrophyIcon } from "@/components/ui/icons";
import { Logo } from "@/components/mascot";
import { Mascot } from "@/components/mascot";

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
  team,
}: {
  name: string;
  dashboard: CoachingDashboard;
  tickets: TicketRow[];
  canOpenTicket: boolean;
  maxTickets: number;
  account: { user: MenuUser; unread: number };
  team: "ADMIN" | "COACH" | null;
}) {
  return (
    <>
      <header className="flex items-center justify-between py-5 lg:hidden">
        <Link href="/learn" aria-label="Creato">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/classement" className="rounded-full bg-card p-2" aria-label="Classement">
            <TrophyIcon size={20} />
          </Link>
          <AccountBar user={account.user} unread={account.unread} />
        </div>
      </header>

      <section className={card}>
        <div className="flex items-center gap-4">
          <RankBadge rank={d.rank} size={56} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-lg font-semibold leading-tight">{name}</p>
            <p className="text-sm text-muted">{team === "ADMIN" ? "Équipe Creato · tu valides tes propres preuves" : team ? "Équipe Creato · tes preuves sont validées par l'admin" : `Coach : ${d.coachName ?? "en cours d'attribution"}`}</p>
          </div>
          <Flame level={d.streak.flame} days={d.streak.current} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Points" value={d.points.total} />
          <Stat label="Record" value={`${d.streak.best} j`} />
          <Stat label="Résultats" value={d.points.quality} />
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
          <Mascot mood="amour" size={112} className="mx-auto" />
          <p className="mt-2 text-lg font-semibold">Coaching terminé : rang SSS !</p>
          <p className="text-sm text-muted">Tu as atteint 1 000 € en un mois. Bravo !</p>
        </section>
      )}

      {d.status === "ACTIVE" && (
        <div className="mt-4 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
          {!d.tiktokUsername || !d.timezone ? (
            <Profile username={d.tiktokUsername} />
          ) : (
            <TodayPost todayDone={d.streak.todayDone} username={d.tiktokUsername} />
          )}

          {!team && (
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
            {tickets.length === 0 && (
              <p className="flex items-center gap-3 text-sm text-muted">
                <Mascot mood="clin-oeil" size={40} /> Aucun échange pour l&apos;instant.
              </p>
            )}
            <ul className="divide-y divide-line">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/coaching/tickets/${t.id}`} className="flex items-center gap-3 py-3">
                    {t.status === "OPEN" ? <MessageCircle size={18} className={t.origin === "COACH" ? "text-gold" : "text-text"} /> : <Lock size={16} className="text-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words leading-snug text-sm font-medium">{t.subject}</span>
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
          )}

          <Results monthlyOpen={d.monthlyOpen} />
          <Videos posts={d.posts} />
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-card-2 p-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
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
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        <Mascot mood={todayDone ? "content" : "motive"} size={40} /> {todayDone ? "Post du jour validé" : "Ton post du jour"}
      </h2>
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

function Videos({ posts }: { posts: CoachingDashboard["posts"] }) {
  return (
    <section className={card}>
      <h2 className="font-semibold">Mes posts</h2>
      <p className="mt-1 text-xs text-muted">Les liens envoyés pour ta flamme (un post par jour suffit).</p>
      {posts.length === 0 && <p className="mt-3 text-sm text-muted">Ajoute ton premier post ci-dessus.</p>}
      <ul className="mt-2 divide-y divide-line">
        {posts.slice(0, 10).map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="w-24 text-muted">{frDay(p.localDate)}</span>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 truncate underline">
              Voir <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Résultats : points et rangs passent par les captures (types de résultats lus par l'IA).
function Results({ monthlyOpen }: { monthlyOpen: boolean }) {
  return (
    <section className={`${card} lg:col-span-2`}>
      <div className="flex items-center gap-3">
        <Mascot mood="motive" size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Mes résultats</h2>
          <p className="text-sm text-muted">
            Une vidéo qui marche, tes revenus, tes abonnés : envoie la capture, gagne des points et débloque les rangs A à SSS.
            {monthlyOpen && <span className="text-gold"> Aujourd&apos;hui, c&apos;est le jour des revenus du mois !</span>}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/resultats/publier" className="flex items-center justify-center gap-1.5 rounded-2xl bg-text py-3 text-sm font-semibold text-black">
          <Plus size={16} /> Publier un résultat
        </Link>
        <Link href="/resultats" className="flex items-center justify-center gap-1.5 rounded-2xl bg-card-2 py-3 text-sm font-semibold">
          Voir les résultats <ChevronRight size={16} />
        </Link>
      </div>
    </section>
  );
}

function Reactivation({ pending: alreadyPending }: { pending: boolean }) {
  const { pending, error, run } = useAction();
  const [reason, setReason] = useState("");
  return (
    <section className={`${card} mt-4 border-danger/50`}>
      <Mascot mood="triste" size={72} />
      <h2 className="mt-2 font-semibold">Ton coaching est en pause</h2>
      <p className="mt-1 text-sm text-muted">Tu n&apos;as pas posté pendant 7 jours : ta place et le rôle @Élite ont été retirés.</p>
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
