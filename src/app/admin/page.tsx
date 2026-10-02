import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/server/db";
import { LESSON_TYPES, TypeBadge } from "@/components/learn/badges";
import { QUIZ_QUESTION_COUNT } from "@/server/quizzes/rules";
import { isPracticeReady, parsePracticeConfig } from "@/server/practice/config";
import { CATALOGS, catalogOfLesson } from "@/server/decisions/catalog";

export default async function AdminHome() {
  const levels = await prisma.level.findMany({
    orderBy: { position: "asc" },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" }, include: { _count: { select: { quizQuestions: true } } } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Parcours</h1>
        <p className="mt-1 text-sm text-muted">L&apos;éditeur complet (modules, leçons, ordre) arrive au bloc 6. Ici : les QCM, la correction des exercices, les catalogues et le lancement.</p>
      </div>
      {levels.map((level) => (
        <section key={level.id}>
          <h2 className="mb-3 text-lg font-semibold">
            <span className="text-muted">Niveau {level.position} · </span>
            {level.title}
          </h2>
          <div className="space-y-3">
            {level.modules.map((mod) => (
              <div key={mod.id} className="rounded-3xl border border-line bg-card p-4">
                <p className="font-semibold">{mod.title}</p>
                <ul className="mt-2 divide-y divide-line">
                  {mod.lessons.map((lesson) => {
                    const isQuiz = lesson.type === "UNDERSTANDING";
                    const isPractice = lesson.type === "PRACTICE_AI";
                    const count = lesson._count.quizQuestions;
                    const practice = isPractice ? parsePracticeConfig(lesson.config) : null;
                    const catalog = lesson.type === "DECISION" ? catalogOfLesson(lesson.config) : null;
                    const href = isQuiz
                      ? `/admin/quiz/${lesson.id}`
                      : isPractice
                        ? `/admin/practice/${lesson.id}`
                        : catalog
                          ? `/admin/catalogs?c=${catalog}`
                          : lesson.type === "CODE_VALIDATION"
                            ? `/admin/launch/${lesson.id}`
                            : null;
                    const row = (
                      <>
                        <TypeBadge type={lesson.type} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{lesson.title}</span>
                          <span className="block text-xs text-muted">
                            {LESSON_TYPES[lesson.type].label}
                            {isQuiz && (
                              <span className={count === QUIZ_QUESTION_COUNT ? "text-success" : "text-gold"}>
                                {" "}
                                · {count}/{QUIZ_QUESTION_COUNT} questions
                              </span>
                            )}
                            {catalog && <span> · catalogue {CATALOGS[catalog].plural.toLowerCase()}</span>}
                            {practice && (
                              <span className={isPracticeReady(practice) ? "text-success" : "text-gold"}>
                                {" "}
                                · {isPracticeReady(practice) ? `${practice.criteria.length} critère${practice.criteria.length > 1 ? "s" : ""}` : "à configurer"}
                              </span>
                            )}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={lesson.id}>
                        {href ? (
                          <Link href={href} className="flex items-center gap-3 py-3">
                            {row}
                            <ChevronRight size={16} className="text-muted" />
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 py-3">{row}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
