import { FlameIcon } from "@/components/ui/icons";
import type { ActivityGrid as Grid, DayState } from "@/server/coaching/rules";

// Grille de régularité façon GitHub : une colonne par semaine (lundi en haut), une case par jour.
const CELL: Record<DayState, string> = {
  posted: "bg-gradient-to-br from-amber-300 to-orange-500",
  frozen: "bg-sky-300",
  missed: "bg-red-900/80",
  before: "bg-white/[0.06]",
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
      <p className="mt-2 text-4xl font-bold">
        {grid.percent}
        <span className="text-2xl">%</span>
        <span className="ml-2 text-sm font-normal text-muted">des jours postés</span>
      </p>
      <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Régularité : ${grid.percent} % des jours postés`}>
        {grid.weeks.flat().map((c) => (
          <span key={c.day} title={frDay(c.day)} className={`aspect-square rounded-[3px] ${CELL[c.state]}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
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
            <p className="flex items-center gap-1 text-2xl font-bold">
              <FlameIcon size={24} level={current > 0 ? 1 : 0} /> {current} <span className="text-sm font-normal text-muted">{current > 1 ? "jours" : "jour"}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Record</p>
            <p className="flex items-center gap-1 text-2xl font-bold">
              <FlameIcon size={24} level={(best ?? 0) > 0 ? 1 : 0} /> {best} <span className="text-sm font-normal text-muted">{(best ?? 0) > 1 ? "jours" : "jour"}</span>
            </p>
          </div>
          <div className="col-span-2 mt-1 flex justify-between" aria-label="Cette semaine">
            {grid.thisWeek.map((s, i) => (
              <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${s === "posted" ? "border-orange-400 bg-gradient-to-br from-amber-300 to-orange-500 text-black" : s === "frozen" ? "border-sky-300 bg-sky-300 text-black" : "border-line text-muted"}`}>
                {DAYS[i]}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
