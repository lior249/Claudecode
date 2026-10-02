import { prisma } from "@/server/db";
import { QUIZ_QUESTION_COUNT } from "@/server/quizzes/rules";
import { isPracticeReady, parsePracticeConfig } from "@/server/practice/config";
import { CATALOGS, catalogOfLesson } from "@/server/decisions/catalog";
import { parseLaunchConfig } from "@/server/launch/rules";
import { CurriculumEditor, type LevelNode } from "@/components/admin/curriculum-editor";

// Statut « prêt / à configurer » et lien vers la configuration de chaque leçon.
function lessonSetup(lesson: { id: string; type: string; config: unknown; _count: { quizQuestions: number } }) {
  switch (lesson.type) {
    case "UNDERSTANDING": {
      const n = lesson._count.quizQuestions;
      return { href: `/admin/quiz/${lesson.id}`, ready: n === QUIZ_QUESTION_COUNT, label: `${n}/${QUIZ_QUESTION_COUNT} questions` };
    }
    case "PRACTICE_AI": {
      const c = parsePracticeConfig(lesson.config);
      const ready = isPracticeReady(c);
      return { href: `/admin/practice/${lesson.id}`, ready, label: ready ? `${c.criteria.length} critère${c.criteria.length > 1 ? "s" : ""}` : "à configurer" };
    }
    case "DECISION": {
      const cat = catalogOfLesson(lesson.config);
      return { href: cat ? `/admin/catalogs?c=${cat}` : null, ready: Boolean(cat), label: cat ? `catalogue ${CATALOGS[cat].plural.toLowerCase()}` : "catalogue manquant" };
    }
    case "CODE_VALIDATION": {
      const c = parseLaunchConfig(lesson.config);
      return { href: `/admin/launch/${lesson.id}`, ready: Boolean(c.code), label: c.code ? "phrase + code prêts" : "code manquant" };
    }
    default:
      return { href: null, ready: false, label: "" };
  }
}

export default async function AdminHome() {
  const levels = await prisma.level.findMany({
    orderBy: { position: "asc" },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { _count: { select: { quizQuestions: true, progress: true } } },
          },
        },
      },
    },
  });

  const tree: LevelNode[] = levels.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    isPublished: l.isPublished,
    modules: l.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      whopUrl: m.whopUrl ?? "",
      isPublished: m.isPublished,
      lessons: m.lessons.map((x) => ({
        id: x.id,
        title: x.title,
        type: x.type,
        isPublished: x.isPublished,
        learners: x._count.progress,
        setup: lessonSetup(x),
      })),
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Parcours</h1>
        <p className="mt-1 text-sm text-muted">
          Niveau → module → leçon. Une nouvelle leçon est créée masquée : configure-la, puis rends-la visible.
        </p>
      </div>
      <CurriculumEditor levels={tree} />
    </div>
  );
}
