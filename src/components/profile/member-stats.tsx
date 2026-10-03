"use client";

import type { ReactNode } from "react";

// Petits blocs partagés par « Mon profil » et la fiche d'un membre du classement.
export const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export function StatTile({ label, value, gold }: { label: string; value: ReactNode; gold?: boolean }) {
  const long = typeof value === "string" && value.length > 6; // ex. « 12 500 € »
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-card-2 px-2 py-3 text-center">
      <div className={`flex items-center gap-1 whitespace-nowrap font-bold tabular-nums ${long ? "text-lg" : "text-2xl"} ${gold ? "text-gold" : ""}`}>{value}</div>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
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
      <h3 className="text-base font-semibold">Revenus</h3>
      <ul className="mt-1 divide-y divide-line text-sm">
        {rows.map(([label, value, strong]) => (
          <li key={label} className="flex items-center justify-between py-2.5">
            <span className="text-muted">{label}</span>
            <span className={`tabular-nums ${strong ? "text-lg font-bold text-gold" : "font-semibold"}`}>{eur(value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
