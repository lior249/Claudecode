"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import { LESSON_TYPES, TypeBadge } from "@/components/learn/badges";
import {
  createLessonAction,
  createLevelAction,
  createModuleAction,
  moveAction,
  removeAction,
  updateLessonAction,
  updateLevelAction,
  updateModuleAction,
} from "@/app/actions/admin-curriculum";

export interface LessonNode {
  id: string;
  title: string;
  type: LessonType;
  isPublished: boolean;
  learners: number;
  setup: { href: string | null; ready: boolean; label: string };
}
export interface ModuleNode {
  id: string;
  title: string;
  description: string;
  whopUrl: string;
  isPublished: boolean;
  lessons: LessonNode[];
}
export interface LevelNode {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
  modules: ModuleNode[];
}

type Result = { ok: true } | { ok: false; error: string };
const field = "w-full rounded-xl border border-line bg-bg p-2.5 text-sm outline-none focus:border-gold";
const NEW_TYPES: { value: string; label: string }[] = [
  { value: "UNDERSTANDING", label: "Compréhension (QCM)" },
  { value: "PRACTICE_AI", label: "Pratique (corrigée par l'IA)" },
  { value: "DECISION:niches", label: "Décision : niche" },
  { value: "DECISION:countries", label: "Décision : pays" },
  { value: "DECISION:methods10k", label: "Décision : méthode 10K" },
  { value: "CODE_VALIDATION", label: "Validation par code" },
];

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else setError(res.error);
    });
  return { pending, error, run };
}

export function CurriculumEditor({ levels }: { levels: LevelNode[] }) {
  const { pending, error, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  return (
    <div className="space-y-6">
      {error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {levels.map((level, i) => (
        <LevelBlock key={level.id} level={level} first={i === 0} last={i === levels.length - 1} />
      ))}
      {adding ? (
        <div className="flex gap-2 rounded-3xl border border-line bg-card p-3">
          <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nom du niveau" className={field} />
          <button
            disabled={pending}
            onClick={() => run(() => createLevelAction({ title: newTitle, description: "" }), () => (setAdding(false), setNewTitle("")))}
            className="shrink-0 rounded-xl bg-text px-4 text-sm font-semibold text-black"
          >
            Ajouter
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line py-4 text-sm text-muted">
          <Plus size={16} /> Ajouter un niveau
        </button>
      )}
    </div>
  );
}

function Toolbar({ kind, id, first, last, isPublished, onEdit, onToggle }: {
  kind: "level" | "module" | "lesson";
  id: string;
  first: boolean;
  last: boolean;
  isPublished: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { pending, error, run } = useAction();
  const btn = "rounded-lg p-1.5 text-muted hover:bg-card-2 disabled:opacity-30";
  return (
    <div className="flex items-center gap-0.5">
      <button disabled={first || pending} onClick={() => run(() => moveAction({ kind, id, direction: "up" }))} className={btn} aria-label="Monter">
        <ChevronUp size={16} />
      </button>
      <button disabled={last || pending} onClick={() => run(() => moveAction({ kind, id, direction: "down" }))} className={btn} aria-label="Descendre">
        <ChevronDown size={16} />
      </button>
      <button onClick={onToggle} className={btn} aria-label={isPublished ? "Masquer" : "Rendre visible"} title={isPublished ? "Visible — cliquer pour masquer" : "Masqué — cliquer pour rendre visible"}>
        {isPublished ? <Eye size={16} /> : <EyeOff size={16} className="text-gold" />}
      </button>
      <button onClick={onEdit} className={btn} aria-label="Modifier">
        <Pencil size={15} />
      </button>
      <button
        disabled={pending}
        onClick={() => window.confirm("Supprimer définitivement ?") && run(() => removeAction({ kind, id }))}
        className={btn}
        aria-label="Supprimer"
      >
        <Trash2 size={15} />
      </button>
      {error && <span className="ml-2 max-w-48 text-xs text-danger">{error}</span>}
    </div>
  );
}

function LevelBlock({ level, first, last }: { level: LevelNode; first: boolean; last: boolean }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(level.title);
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const save = (isPublished = level.isPublished) =>
    run(() => updateLevelAction({ id: level.id, title, description: level.description, isPublished }), () => setEditing(false));

  return (
    <section className={level.isPublished ? "" : "opacity-60"}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
            <button disabled={pending} onClick={() => save()} className="shrink-0 rounded-xl bg-text px-3 text-sm font-semibold text-black">
              OK
            </button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold">{level.title}</h2>
        )}
        <Toolbar kind="level" id={level.id} first={first} last={last} isPublished={level.isPublished} onEdit={() => setEditing((v) => !v)} onToggle={() => save(!level.isPublished)} />
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="space-y-3">
        {level.modules.map((m, i) => (
          <ModuleBlock key={m.id} mod={m} first={i === 0} last={i === level.modules.length - 1} />
        ))}
        {addingModule ? (
          <div className="flex gap-2 rounded-3xl border border-line bg-card p-3">
            <input autoFocus value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="Nom du module" className={field} />
            <button
              disabled={pending}
              onClick={() =>
                run(() => createModuleAction({ levelId: level.id, title: moduleTitle, description: "", whopUrl: "" }), () => (setAddingModule(false), setModuleTitle("")))
              }
              className="shrink-0 rounded-xl bg-text px-4 text-sm font-semibold text-black"
            >
              Ajouter
            </button>
          </div>
        ) : (
          <button onClick={() => setAddingModule(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-sm text-muted">
            <Plus size={14} /> Ajouter un module
          </button>
        )}
      </div>
    </section>
  );
}

function ModuleBlock({ mod, first, last }: { mod: ModuleNode; first: boolean; last: boolean }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(mod.title);
  const [description, setDescription] = useState(mod.description);
  const [whop, setWhop] = useState(mod.whopUrl);
  const [adding, setAdding] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState("PRACTICE_AI");
  const save = (isPublished = mod.isPublished) =>
    run(() => updateModuleAction({ id: mod.id, title, description, whopUrl: whop, isPublished }), () => setEditing(false));

  return (
    <div className={`rounded-3xl border border-line bg-card p-4 ${mod.isPublished ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{mod.title}</p>
          <p className={`truncate text-xs ${mod.whopUrl ? "text-muted" : "text-gold"}`}>{mod.whopUrl || "Lien Whop manquant"}</p>
        </div>
        <Toolbar kind="module" id={mod.id} first={first} last={last} isPublished={mod.isPublished} onEdit={() => setEditing((v) => !v)} onToggle={() => save(!mod.isPublished)} />
      </div>
      {editing && (
        <div className="mt-3 space-y-2 rounded-2xl bg-bg/40 p-3">
          <label className="block text-xs text-muted">
            Nom
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs text-muted">
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs text-muted">
            Lien d&apos;accès Whop (secret, révélé seulement quand le module est débloqué)
            <input value={whop} onChange={(e) => setWhop(e.target.value)} placeholder="https://whop.com/…" inputMode="url" className={`${field} mt-1`} />
          </label>
          <button disabled={pending} onClick={() => save()} className="rounded-xl bg-text px-4 py-2 text-sm font-semibold text-black">
            Enregistrer
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <ul className="mt-3 divide-y divide-line">
        {mod.lessons.map((lesson, i) => (
          <LessonRow key={lesson.id} lesson={lesson} first={i === 0} last={i === mod.lessons.length - 1} />
        ))}
      </ul>

      {adding ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-bg/40 p-3">
          <input autoFocus value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Titre de la leçon" className={field} />
          <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} className={field}>
            {NEW_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            disabled={pending}
            onClick={() => {
              const [type, catalog] = lessonType.split(":");
              run(() => createLessonAction({ moduleId: mod.id, title: lessonTitle, type, catalog }), () => (setAdding(false), setLessonTitle("")));
            }}
            className="rounded-xl bg-text px-4 py-2 text-sm font-semibold text-black"
          >
            Ajouter la leçon
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Plus size={14} /> Ajouter une leçon
        </button>
      )}
    </div>
  );
}

function LessonRow({ lesson, first, last }: { lesson: LessonNode; first: boolean; last: boolean }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const save = (isPublished = lesson.isPublished) =>
    run(() => updateLessonAction({ id: lesson.id, title, isPublished }), () => setEditing(false));

  return (
    <li className={`py-3 ${lesson.isPublished ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <TypeBadge type={lesson.type} size={28} />
        <div className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
          {editing ? (
            <div className="flex gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
              <button disabled={pending} onClick={() => save()} className="shrink-0 rounded-xl bg-text px-3 text-sm font-semibold text-black">
                OK
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-medium">{lesson.title}</p>
              <p className="text-xs text-muted">
                {LESSON_TYPES[lesson.type].label}
                {lesson.setup.label && <span className={lesson.setup.ready ? "text-success" : "text-gold"}> · {lesson.setup.label}</span>}
                {!lesson.isPublished && <span className="text-gold"> · masquée</span>}
                {lesson.learners > 0 && <span> · {lesson.learners} élève{lesson.learners > 1 ? "s" : ""}</span>}
              </p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
            {lesson.setup.href && (
              <Link href={lesson.setup.href} className="flex items-center gap-1 rounded-lg bg-card-2 px-2.5 py-1.5 text-xs">
                <Settings2 size={13} /> Configurer
              </Link>
            )}
            <Toolbar kind="lesson" id={lesson.id} first={first} last={last} isPublished={lesson.isPublished} onEdit={() => setEditing((v) => !v)} onToggle={() => save(!lesson.isPublished)} />
          </div>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </li>
  );
}
