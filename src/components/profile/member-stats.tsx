"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Petits blocs partagés par « Mon profil » et la fiche d'un membre du classement.
export const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export function StatTile({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-card-2 p-3 text-center">
      <p className={`text-lg font-bold ${gold ? "text-gold" : ""}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

// Revenus : trois lignes seulement (résultats validés par un coach).
export function Revenue({ lastMonthEur, bestMonthEur, totalEur }: { lastMonthEur: number; bestMonthEur: number; totalEur: number }) {
  const rows: [string, number, boolean][] = [
    ["Mois dernier", lastMonthEur, false],
    ["Meilleur mois", bestMonthEur, false],
    ["Total généré", totalEur, true],
  ];
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Revenus</h3>
      <ul className="mt-1 divide-y divide-line text-sm">
        {rows.map(([label, value, strong]) => (
          <li key={label} className="flex justify-between py-2.5">
            <span className="text-muted">{label}</span>
            <span className={strong ? "font-bold text-gold" : "font-semibold"}>{eur(value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Album des captures de résultats du mois : 2 colonnes de même largeur, hauteur libre (image jamais écrasée ni coupée).
export function ResultsAlbum({ months }: { months: { id: string; month: string; amountEur: number; imageUrl: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = months.find((m) => m.id === open) ?? null;
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  const cols = [months.filter((_, i) => i % 2 === 0), months.filter((_, i) => i % 2 === 1)];
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Résultats du mois</h3>
      {months.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Aucun résultat validé pour l&apos;instant.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 items-start gap-2">
          {cols.map((col, c) => (
            <div key={c} className="grid min-w-0 content-start gap-2">
              {col.map((m) => (
                <button key={m.id} onClick={() => setOpen(m.id)} className="relative block w-full overflow-hidden rounded-xl border border-line" aria-label={`Agrandir le résultat de ${monthLabel(m.month)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.imageUrl} alt={`Résultat de ${monthLabel(m.month)}`} loading="lazy" className="block h-auto w-full" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-white">
                    {monthLabel(m.month)} · {eur(m.amountEur)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {current && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={`Résultat de ${monthLabel(current.month)}`}>
          <button onClick={() => setOpen(null)} className="absolute right-4 top-4 rounded-full bg-card p-2 text-muted" aria-label="Fermer">
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.imageUrl} alt={`Résultat de ${monthLabel(current.month)}`} className="max-h-[85dvh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </section>
  );
}
