"use client";

import Link from "next/link";
import { NotificationBell } from "@/components/notifications/bell";
import { useState, useTransition } from "react";
import { Check, ChevronRight, ExternalLink, Lock, LogOut, X } from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import type { Rank, Status } from "@/server/learn/progression";
import { devCompleteLesson } from "@/app/actions/learn";
import { logout } from "@/app/actions/auth";
import { LESSON_TYPES, RankBadge, TypeBadge } from "./badges";
import { Countdown } from "./countdown";
import { LocalTime } from "@/components/local-time";

export interface LessonView {
  id: string;
  title: string;
  summary: string;
  type: LessonType;
  status: Status;
  deadlineAt: string | null;
  completedAt: string | null;
}
export interface ModuleView {
  id: string;
  title: string;
  description: string;
  status: Status;
  whopUrl: string | null;
  lessons: LessonView[];
}
export interface LearnViewData {
  displayName: string;
  rank: Rank;
  percent: number;
  completedLessons: number;
  totalLessons: number;
  learnCompleted: boolean;
  currentLessonId: string | null;
  devTools: boolean;
  isAdmin: boolean;
  inCoaching: boolean;
  unread: number;
  levels: { id: string; title: string; position: number; status: Status; modules: ModuleView[] }[];
}

const VISIBLE_LOCKED_MODULES = 3;
const LESSON_HREF: Partial<Record<LessonType, string>> = {
  UNDERSTANDING: "/learn/quiz",
  PRACTICE_AI: "/learn/practice",
  DECISION: "/learn/decision",
  CODE_VALIDATION: "/learn/launch",
};
const LOCKED_OPACITY = [0.55, 0.35, 0.2];

export function LearnView({ data }: { data: LearnViewData }) {
  const [openLesson, setOpenLesson] = useState<{ lesson: LessonView; mod: ModuleView } | null>(null);

  const current = data.levels
    .flatMap((l) => l.modules.flatMap((m) => m.lessons.map((lesson) => ({ lesson, mod: m, level: l }))))
    .find((x) => x.lesson.id === data.currentLessonId);

  // Seuls les 3 prochains modules verrouillés sont montrés, de plus en plus discrets.
  let lockedSeen = 0;
  const levels = data.levels
    .map((level) => ({
      ...level,
      modules: level.modules.flatMap((m) => {
        if (m.status !== "LOCKED") return [{ mod: m, opacity: 1 }];
        if (lockedSeen >= VISIBLE_LOCKED_MODULES) return [];
        return [{ mod: m, opacity: LOCKED_OPACITY[lockedSeen++] }];
      }),
    }))
    .filter((l) => l.modules.length > 0);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-24">
      {/* En-tête */}
      <header className="flex items-center justify-between py-5">
        <span className="logo text-3xl">Creato</span>
        <div className="flex items-center gap-2">
        <NotificationBell unread={data.unread} />
        {data.inCoaching && (
          <Link href="/coaching" className="rounded-full bg-gold px-3 py-2 text-xs font-semibold text-black">
            Coaching
          </Link>
        )}
        {data.isAdmin && (
          <Link href="/admin" className="rounded-full bg-gold/15 px-3 py-2 text-xs font-medium text-gold">
            Admin
          </Link>
        )}
        <form action={logout}>
          <button className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-xs text-muted" aria-label="Déconnexion">
            <LogOut size={14} /> Quitter
          </button>
        </form>
        </div>
      </header>

      {/* Carte joueur */}
      <section className="rounded-3xl border border-line bg-card p-5">
        <div className="flex items-center gap-4">
          <RankBadge rank={data.rank} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{data.displayName}</p>
            <p className="text-sm text-muted">Rang {data.rank}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{data.percent}%</p>
            <p className="text-xs text-muted">
              {data.completedLessons}/{data.totalLessons} leçons
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-card-2">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${data.percent}%` }} />
        </div>
      </section>

      {/* Leçon en cours */}
      {current ? (
        <section className="mt-4">
          <h2 className="mb-2 px-1 text-sm font-medium text-muted">À faire maintenant</h2>
          <button
            onClick={() => setOpenLesson({ lesson: current.lesson, mod: current.mod })}
            className="flex w-full items-center gap-4 rounded-3xl border border-gold/40 bg-card-2 p-4 text-left"
          >
            <TypeBadge type={current.lesson.type} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">
                Niveau {current.level.position} · {current.mod.title}
              </p>
              <p className="truncate font-semibold">{current.lesson.title}</p>
              {current.lesson.deadlineAt && (
                <p className="mt-1 text-xs">
                  <Countdown deadlineAt={current.lesson.deadlineAt} />
                </p>
              )}
            </div>
            <ChevronRight className="text-muted" />
          </button>
        </section>
      ) : data.learnCompleted ? (
        <section className="mt-4 rounded-3xl border border-gold/40 bg-card-2 p-5 text-center">
          <p className="text-3xl">👑</p>
          <p className="mt-2 text-lg font-semibold">Bravo, tu as terminé ton parcours Learn !</p>
          <p className="mt-1 text-sm text-muted">Ton accès au coaching est débloqué.</p>
        </section>
      ) : null}

      {/* Parcours vertical */}
      <div className="mt-8 space-y-8">
        {levels.map((level) => (
          <section key={level.id}>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-lg font-semibold">
                <span className="text-muted">Niveau {level.position} · </span>
                {level.title}
              </h2>
              {level.status === "COMPLETED" && <span className="text-xs font-medium text-success">Terminé</span>}
            </div>
            <div className="space-y-3">
              {level.modules.map(({ mod, opacity }) => (
                <ModuleCard
                  key={`${mod.id}-${mod.status}`}
                  mod={mod}
                  opacity={opacity}
                  currentLessonId={data.currentLessonId}
                  onOpen={(lesson) => setOpenLesson({ lesson, mod })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {openLesson && (
        <LessonSheet
          lesson={openLesson.lesson}
          mod={openLesson.mod}
          isCurrent={openLesson.lesson.id === data.currentLessonId}
          devTools={data.devTools}
          onClose={() => setOpenLesson(null)}
        />
      )}
    </main>
  );
}

function ModuleCard({
  mod,
  opacity,
  currentLessonId,
  onOpen,
}: {
  mod: ModuleView;
  opacity: number;
  currentLessonId: string | null;
  onOpen: (lesson: LessonView) => void;
}) {
  const [expanded, setExpanded] = useState(mod.status === "AVAILABLE");
  const locked = mod.status === "LOCKED";
  const done = mod.lessons.filter((l) => l.status === "COMPLETED").length;

  return (
    <div className="rounded-3xl border border-line bg-card" style={{ opacity }}>
      <button
        disabled={locked}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            mod.status === "COMPLETED" ? "bg-success/15 text-success" : locked ? "bg-card-2 text-muted" : "bg-gold/15 text-gold"
          }`}
        >
          {mod.status === "COMPLETED" ? <Check size={20} /> : locked ? <Lock size={18} /> : <span className="font-bold">{done}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{mod.title}</p>
          <p className="truncate text-xs text-muted">
            {mod.status === "COMPLETED" ? "Terminé" : locked ? "Verrouillé" : `En cours · ${done}/${mod.lessons.length}`}
          </p>
        </div>
        {!locked && <ChevronRight size={18} className={`text-muted transition-transform ${expanded ? "rotate-90" : ""}`} />}
      </button>

      {expanded && !locked && (
        <div className="border-t border-line px-4 pb-4 pt-2">
          {mod.whopUrl && (
            <a
              href={mod.whopUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-card-2 py-3 text-sm font-medium"
            >
              Voir le module sur Whop <ExternalLink size={14} />
            </a>
          )}
          <ol className="relative">
            {mod.lessons.map((lesson, i) => {
              const isCurrent = lesson.id === currentLessonId;
              const isLocked = lesson.status === "LOCKED";
              return (
                <li key={lesson.id} className="relative">
                  {i < mod.lessons.length - 1 && <span className="absolute left-[19px] top-12 h-[calc(100%-32px)] w-px bg-line" />}
                  <button
                    disabled={isLocked}
                    onClick={() => onOpen(lesson)}
                    className={`flex w-full items-center gap-3 rounded-2xl py-2 text-left ${isCurrent ? "" : ""}`}
                  >
                    <span className="relative" style={{ opacity: isLocked ? 0.35 : 1 }}>
                      <TypeBadge type={lesson.type} size={38} />
                      {lesson.status === "COMPLETED" && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-black">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 ${isLocked ? "text-muted" : ""}`}>
                      <span className="block truncate text-sm font-medium">{lesson.title}</span>
                      <span className="block text-xs text-muted">
                        {LESSON_TYPES[lesson.type].label}
                        {isCurrent && <span className="text-gold"> · En cours</span>}
                      </span>
                    </span>
                    {isLocked ? <Lock size={14} className="text-muted" /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function LessonSheet({
  lesson,
  mod,
  isCurrent,
  devTools,
  onClose,
}: {
  lesson: LessonView;
  mod: ModuleView;
  isCurrent: boolean;
  devTools: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = LESSON_TYPES[lesson.type];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-line bg-card p-6 pb-10 sm:rounded-3xl sm:pb-6"
      >
        <div className="flex items-start gap-4">
          <TypeBadge type={lesson.type} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              {mod.title} · {t.label}
            </p>
            <h3 id="lesson-title" className="text-xl font-semibold">
              {lesson.title}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-card-2 p-2 text-muted" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-text/90">{lesson.summary}</p>

        <div className="mt-5 rounded-2xl bg-card-2 p-4 text-sm">
          {lesson.status === "COMPLETED" ? (
            <p className="flex items-center gap-2 font-medium text-success">
              <Check size={16} /> Validée le <LocalTime iso={lesson.completedAt!} date />
            </p>
          ) : (
            <>
              <p className="font-medium">À faire maintenant</p>
              {lesson.deadlineAt && (
                <p className="mt-1">
                  <Countdown deadlineAt={lesson.deadlineAt} />
                </p>
              )}
            </>
          )}
        </div>

        {isCurrent && (
          <div className="mt-5 space-y-2">
            {LESSON_HREF[lesson.type] ? (
              <Link
                href={`${LESSON_HREF[lesson.type]}/${lesson.id}`}
                className="block w-full rounded-2xl bg-text py-4 text-center font-semibold text-black"
              >
                {t.action}
              </Link>
            ) : (
              <>
                <button disabled className="w-full rounded-2xl bg-text py-4 font-semibold text-black opacity-40">
                  {t.action}
                </button>
                <p className="text-center text-xs text-muted">Cet exercice arrive dans un prochain bloc.</p>
              </>
            )}
            {devTools && (
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await devCompleteLesson(lesson.id);
                    if (res.ok) onClose();
                    else setError(res.error);
                  })
                }
                className="w-full rounded-2xl border border-dashed border-gold/60 py-3 text-sm font-medium text-gold disabled:opacity-50"
              >
                {pending ? "Validation…" : "Démo : valider cette leçon"}
              </button>
            )}
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
