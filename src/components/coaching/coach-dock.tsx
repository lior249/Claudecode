"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Lock, MessageCircle, Plus, X } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";

export interface DockData {
  coach: { name: string; avatarUrl: string | null };
  tickets: { id: string; subject: string; open: boolean; waitingCoach: boolean }[];
  canOpenTicket: boolean;
  availability: string[];
  timezone: string;
}

// Bouton « Mon coach » en bas à droite : les échanges avec le coach et ses disponibilités de la semaine.
export function CoachDock({ data }: { data: DockData }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "dispo">("chat");
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const tabCls = (t: string) => `flex-1 rounded-xl py-2 text-sm ${tab === t ? "bg-card-2 font-semibold" : "text-muted"}`;
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-4 z-40 rounded-full border-2 border-gold bg-card p-0.5 shadow-2xl shadow-black/70"
        aria-expanded={open}
        aria-label="Mon coach"
        title="Mon coach"
      >
        <Avatar name={data.coach.name} url={data.coach.avatarUrl} size={48} />
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-gold text-black">
          {open ? <X size={12} strokeWidth={3} /> : <MessageCircle size={12} strokeWidth={3} />}
        </span>
      </button>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-line bg-bg p-3 shadow-2xl shadow-black/70" role="dialog" aria-label="Mon coach">
          <div className="flex items-center gap-3 px-1 pb-3">
            <Avatar name={data.coach.name} url={data.coach.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words leading-snug font-semibold">{data.coach.name}</p>
              <p className="text-xs text-muted">Ton coach</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full bg-card p-2 text-muted" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-1 rounded-2xl bg-card p-1">
            <button className={tabCls("chat")} onClick={() => setTab("chat")}>
              Échanges
            </button>
            <button className={tabCls("dispo")} onClick={() => setTab("dispo")}>
              Disponibilités
            </button>
          </div>
          {tab === "chat" ? (
            <div className="mt-2 max-h-80 overflow-y-auto">
              {data.tickets.length === 0 && <p className="p-3 text-sm text-muted">Aucun échange pour l&apos;instant.</p>}
              <ul className="divide-y divide-line">
                {data.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/coaching/tickets/${t.id}`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-2 py-3">
                      {t.open ? <MessageCircle size={16} /> : <Lock size={14} className="text-muted" />}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words leading-snug text-sm">{t.subject}</span>
                        <span className="block text-xs text-muted">{!t.open ? "Clôturé" : t.waitingCoach ? "En attente du coach" : "Le coach a répondu"}</span>
                      </span>
                      <ChevronRight size={14} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
              {data.canOpenTicket && (
                <Link href="/coaching/tickets/new" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-1 rounded-2xl bg-text py-2.5 text-sm font-semibold text-black">
                  <Plus size={14} /> Nouvelle demande
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2">
              {data.availability.length === 0 ? (
                <p className="text-sm text-muted">Ton coach n&apos;a pas encore indiqué ses disponibilités cette semaine.</p>
              ) : (
                <ul className="space-y-2">
                  {data.availability.map((l) => (
                    <li key={l} className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2.5 text-sm">
                      <CalendarDays size={15} className="text-gold" /> {l}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">Heures affichées dans ton fuseau ({data.timezone}). Passe le voir quand tu es prêt.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
