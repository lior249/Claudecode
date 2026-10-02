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

export function MonthResults({ months }: { months: { month: string; amountEur: number }[] }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <h3 className="text-sm font-semibold">Résultats du mois</h3>
      {months.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Aucun résultat validé pour l&apos;instant.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {months.map((m) => (
            <li key={m.month} className="flex justify-between py-2">
              <span className="capitalize text-muted">{monthLabel(m.month)}</span>
              <span className="font-semibold">{eur(m.amountEur)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
