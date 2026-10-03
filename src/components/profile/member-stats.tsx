"use client";


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
