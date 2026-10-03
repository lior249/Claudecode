"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { markAllReadAction, notificationSettingsAction } from "@/app/actions/notifications";
import { LocalTime } from "@/components/local-time";

export interface NotificationRow {
  id: string;
  text: string;
  href: string | null;
  createdAt: string;
  unread: boolean;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8 h → 21 h

export function NotificationCenter({ items }: { items: NotificationRow[] }) {
  // La page ouverte = tout est lu (le point rouge disparaît à la prochaine visite).
  useEffect(() => {
    if (items.some((n) => n.unread)) void markAllReadAction();
  }, [items]);

  return (
    <>
      {items.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Aucune notification pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const body = (
              <>
                {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger" aria-label="Non lue" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{n.text}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    <LocalTime iso={n.createdAt} />
                  </span>
                </span>
              </>
            );
            const cls = `flex gap-3 rounded-2xl border p-3 ${n.unread ? "border-gold/40 bg-card-2" : "border-line bg-card"}`;
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/reglages" className="mt-6 block text-center text-sm text-muted underline">
        Régler mes rappels
      </Link>
    </>
  );
}

export function ReminderSettings(props: { reminderHour: number; dmEnabled: boolean }) {
  const [hour, setHour] = useState(props.reminderHour);
  const [dm, setDm] = useState(props.dmEnabled);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const save = (next: { reminderHour: number; dmEnabled: boolean }) =>
    start(async () => {
      setSaved(false);
      const res = await notificationSettingsAction(next);
      setSaved(res.ok);
    });
  return (
    <section id="rappels" className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-semibold">Mes rappels</h2>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span>Heure de mon rappel du jour</span>
        <select
          value={hour}
          disabled={pending}
          onChange={(e) => {
            const h = Number(e.target.value);
            setHour(h);
            save({ reminderHour: h, dmEnabled: dm });
          }}
          className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h} h
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span>Recevoir aussi les rappels en message privé Discord</span>
        <input
          type="checkbox"
          checked={dm}
          disabled={pending}
          onChange={(e) => {
            setDm(e.target.checked);
            save({ reminderHour: hour, dmEnabled: e.target.checked });
          }}
          className="h-5 w-5 accent-[var(--color-gold)]"
        />
      </label>
      <p className="mt-3 text-xs text-muted">
        Pas de message entre 22 h et 8 h, 3 au maximum par jour. Seuls les délais qui tournent (24 h d&apos;une leçon, 12 h de réponse d&apos;un coach) peuvent arriver à toute heure.
      </p>
      {saved && <p className="mt-2 text-xs text-success">Enregistré.</p>}
    </section>
  );
}
