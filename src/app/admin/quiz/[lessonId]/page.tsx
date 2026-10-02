import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getQuizForAdmin } from "@/server/quizzes/service";
import { QuizEditor } from "@/components/admin/quiz-editor";

export default async function AdminQuizPage({ params }: PageProps<"/admin/quiz/[lessonId]">) {
  const { lessonId } = await params;
  const quiz = await getQuizForAdmin(lessonId);
  if (!quiz) notFound();
  return (
    <div>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted">
        <ArrowLeft size={16} /> Parcours
      </Link>
      <h1 className="text-2xl font-semibold">{quiz.lesson.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {quiz.lesson.module.title} · QCM de 20 questions, 16 bonnes réponses pour valider. Le QCM s&apos;ouvre aux élèves
        quand les 20 questions sont remplies.
      </p>
      <QuizEditor
        lessonId={lessonId}
        initial={quiz.questions.map((q) => ({
          question: q.question,
          answerA: q.answerA,
          answerB: q.answerB,
          answerC: q.answerC,
          answerD: q.answerD,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        }))}
      />
    </div>
  );
}
