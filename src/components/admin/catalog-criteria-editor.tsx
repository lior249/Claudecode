"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Catalog } from "@/generated/prisma/enums";
import { CATALOGS, OPTION_COLOR_LABELS, OPTION_COLORS, type OptionColor } from "@/server/decisions/catalog";
import type { CriterionView } from "@/server/decisions/criteria";
import { catalogCriteriaAction } from "@/app/actions/admin-catalog";
import { TagBadge } from "@/components/decision/parts";

const field = "min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold";
const iconBtn = "rounded-lg p-1.5 text-muted hover:bg-card-2 hover:text-text disabled:opacity-30";
const SWATCH: Record<OptionColor, string> = {
  gray: "bg-zinc-400",
  green: "bg-success",
  yellow: "bg-gold",
  red: "bg-danger",
  blue: "bg-sky-400",
  purple: "bg-violet-400",
};

type Editing = { kind: "criterion"; id: string } | { kind: "option"; id: string; criterionId: string } | { kind: "newOption"; criterionId: string } | null;

// Critères d'un catalogue (ex. « Concurrence ») et leurs options (ex. « Faible »), affichés sur chaque fiche.
export function CatalogCriteriaEditor({ catalog, criteria }: { catalog: Catalog; criteria: CriterionView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [newCriterion, setNewCriterion] = useState("");

  const run = (payload: object, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await catalogCriteriaAction(payload);
      if (!res.ok) return setError(res.error);
      after?.();
      router.refresh();
    });

  return (
    <section className="rounded-3xl border border-line bg-card p-4 lg:p-5">
      <h2 className="text-lg font-semibold">Critères des {CATALOGS[catalog].plural.toLowerCase()}</h2>
      <p className="mt-0.5 text-xs text-muted">
        Chaque critère a ses options ; sur chaque fiche, tu choisis une option par critère. Les élèves les voient dans la liste et sur la fiche.
      </p>

      <ul className="mt-4 space-y-3">
        {criteria.map((c, i) => {
          const used = c.options.reduce((n, o) => n + o.used, 0);
          return (
            <li key={c.id} className="rounded-2xl bg-card-2/60 p-3">
              <div className="flex items-center gap-2">
                {editing?.kind === "criterion" && editing.id === c.id ? (
                  <CriterionForm initial={c.label} pending={pending} onCancel={() => setEditing(null)} onSave={(label) => run({ op: "renameCriterion", id: c.id, label }, () => setEditing(null))} />
                ) : (
                  <>
                    <p className="min-w-0 flex-1 font-semibold">{c.label}</p>
                    <button className={iconBtn} disabled={pending || i === 0} onClick={() => run({ op: "moveCriterion", id: c.id, dir: -1 })} aria-label={`Monter « ${c.label} »`}>
                      <ChevronUp size={16} />
                    </button>
                    <button className={iconBtn} disabled={pending || i === criteria.length - 1} onClick={() => run({ op: "moveCriterion", id: c.id, dir: 1 })} aria-label={`Descendre « ${c.label} »`}>
                      <ChevronDown size={16} />
                    </button>
                    <button className={iconBtn} disabled={pending} onClick={() => setEditing({ kind: "criterion", id: c.id })} aria-label={`Renommer « ${c.label} »`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className={`${iconBtn} hover:text-danger`}
                      disabled={pending}
                      onClick={() =>
                        window.confirm(`Supprimer le critère « ${c.label} » et ses options ?${used ? ` Il disparaîtra de ${used} fiche${used > 1 ? "s" : ""}.` : ""}`) &&
                        run({ op: "deleteCriterion", id: c.id })
                      }
                      aria-label={`Supprimer « ${c.label} »`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.options.map((o, k) =>
                  editing?.kind === "option" && editing.id === o.id ? (
                    <OptionForm
                      key={o.id}
                      initial={o}
                      pending={pending}
                      onCancel={() => setEditing(null)}
                      onSave={(option) => run({ op: "updateOption", id: o.id, option }, () => setEditing(null))}
                      onDelete={() =>
                        window.confirm(`Supprimer l'option « ${o.label} » ?${o.used ? ` Elle disparaîtra de ${o.used} fiche${o.used > 1 ? "s" : ""}.` : ""}`) &&
                        run({ op: "deleteOption", id: o.id }, () => setEditing(null))
                      }
                      onMove={(dir) => run({ op: "moveOption", id: o.id, dir })}
                      canMoveLeft={k > 0}
                      canMoveRight={k < c.options.length - 1}
                    />
                  ) : (
                    <button key={o.id} onClick={() => setEditing({ kind: "option", id: o.id, criterionId: c.id })} className="rounded-full ring-gold/60 hover:ring-2" title="Modifier l'option">
                      <TagBadge bare tag={{ criterion: c.label, label: o.label, color: o.color }} />
                    </button>
                  ),
                )}
                {editing?.kind === "newOption" && editing.criterionId === c.id ? (
                  <OptionForm initial={{ label: "", color: "gray" }} pending={pending} onCancel={() => setEditing(null)} onSave={(option) => run({ op: "createOption", criterionId: c.id, option }, () => setEditing(null))} />
                ) : (
                  <button onClick={() => setEditing({ kind: "newOption", criterionId: c.id })} className="flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted hover:text-text">
                    <Plus size={12} /> Option
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newCriterion.trim()) run({ op: "createCriterion", catalog, label: newCriterion }, () => setNewCriterion(""));
        }}
      >
        <input value={newCriterion} onChange={(e) => setNewCriterion(e.target.value)} maxLength={40} placeholder="Nouveau critère (ex. : Budget, Langue…)" className={field} />
        <button disabled={pending || !newCriterion.trim()} className="flex shrink-0 items-center gap-1 rounded-xl bg-text px-3 text-sm font-semibold text-black disabled:opacity-40">
          <Plus size={14} /> Ajouter
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}

function CriterionForm({ initial, pending, onSave, onCancel }: { initial: string; pending: boolean; onSave: (label: string) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(initial);
  return (
    <form
      className="flex flex-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(label);
      }}
    >
      <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} className={field} aria-label="Nom du critère" />
      <button disabled={pending || !label.trim()} className="rounded-xl bg-text px-3 text-sm font-semibold text-black disabled:opacity-40">
        OK
      </button>
      <button type="button" onClick={onCancel} className={iconBtn} aria-label="Annuler">
        <X size={16} />
      </button>
    </form>
  );
}

function OptionForm({
  initial,
  pending,
  onSave,
  onCancel,
  onDelete,
  onMove,
  canMoveLeft,
  canMoveRight,
}: {
  initial: { label: string; color: OptionColor };
  pending: boolean;
  onSave: (o: { label: string; color: OptionColor }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onMove?: (dir: -1 | 1) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
}) {
  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState<OptionColor>(initial.color);
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-gold/40 bg-bg p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ label, color });
      }}
    >
      <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Nom de l'option" className={field} aria-label="Nom de l'option" />
      <span className="flex gap-1" role="radiogroup" aria-label="Couleur">
        {OPTION_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={OPTION_COLOR_LABELS[c]}
            title={OPTION_COLOR_LABELS[c]}
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full ${SWATCH[c]} ${color === c ? "ring-2 ring-text ring-offset-2 ring-offset-bg" : "opacity-60"}`}
          />
        ))}
      </span>
      {onMove && (
        <>
          <button type="button" className={iconBtn} disabled={pending || !canMoveLeft} onClick={() => onMove(-1)} aria-label="Avancer l'option">
            <ChevronUp size={16} className="-rotate-90" />
          </button>
          <button type="button" className={iconBtn} disabled={pending || !canMoveRight} onClick={() => onMove(1)} aria-label="Reculer l'option">
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </>
      )}
      <button disabled={pending || !label.trim()} className="rounded-xl bg-text px-3 py-2 text-sm font-semibold text-black disabled:opacity-40">
        OK
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} disabled={pending} className={`${iconBtn} hover:text-danger`} aria-label="Supprimer l'option">
          <Trash2 size={15} />
        </button>
      )}
      <button type="button" onClick={onCancel} className={iconBtn} aria-label="Annuler">
        <X size={16} />
      </button>
    </form>
  );
}
