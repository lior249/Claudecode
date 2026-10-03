import type { ActivityGrid as Grid, DayState } from "@/server/coaching/rules";

// Grille de régularité façon GitHub : une colonne par semaine (lundi en haut), une case par jour.
const CELL: Record<DayState, string> = {
  posted: "bg-sky-400",
  frozen: "bg-sky-200/70",
  missed: "bg-sky-950",
  before: "bg-white/[0.04]",
  future: "bg-transparent",
};
const LEGEND: [DayState, string][] = [
  ["posted", "Posté"],
  ["frozen", "Gel"],
  ["missed", "Manqué"],
];
const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const frDay = (d: string) => d.split("-").reverse().join("/");

export function ActivityGrid({ grid, current, best }: { grid: Grid; current?: number; best?: number }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Régularité</h3>
        <span className="text-xs text-muted">18 dernières semaines</span>
      </div>
      <p className="mt-2 text-3xl font-semibold">
        {grid.percent}
        <span className="ml-1 text-sm font-normal text-muted">% des jours postés</span>
      </p>
      <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Régularité : ${grid.percent} % des jours postés`}>
        {grid.weeks.flat().map((c) => (
          <span key={c.day} title={frDay(c.day)} className={`aspect-square rounded-[3px] ${CELL[c.state]}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
        {LEGEND.map(([s, label]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-[3px] ${CELL[s]}`} /> {label}
          </span>
        ))}
      </div>
      {current !== undefined && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <div>
            <p className="text-xs text-muted">Flamme actuelle</p>
            <p className="text-xl font-semibold">
              🔥 {current} <span className="text-sm font-normal text-muted">{current > 1 ? "jours" : "jour"}</span>
            </p>
            <div className="mt-2 flex gap-1.5" aria-label="Cette semaine">
              {grid.thisWeek.map((s, i) => (
                <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full border text-[9px] ${s === "posted" ? "border-orange-400 bg-orange-400 text-black" : s === "frozen" ? "border-sky-300 bg-sky-300/60 text-black" : "border-line text-muted"}`}>
                  {DAYS[i]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted">Record</p>
            <p className="text-xl font-semibold">
              🔥 {best} <span className="text-sm font-normal text-muted">{(best ?? 0) > 1 ? "jours" : "jour"}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
