"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { getQuizForAdmin, QuizError, saveQuizQuestions } from "@/server/quizzes/service";
import { QUIZ_QUESTION_COUNT } from "@/server/quizzes/rules";

const text = (max: number) => z.string().trim().min(1).max(max);
const question = z.object({
  question: text(500),
  answerA: text(300),
  answerB: text(300),
  answerC: text(300),
  answerD: text(300),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().trim().max(1000),
});
const input = z.object({ lessonId: z.string().min(1).max(64), questions: z.array(question).max(QUIZ_QUESTION_COUNT) });

export async function saveQuiz(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireUser(["ADMIN"]);
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const n = typeof issue.path[1] === "number" ? issue.path[1] + 1 : null;
    return { ok: false, error: n ? `Question ${n} : remplis la question, les 4 réponses et choisis la bonne.` : "Formulaire invalide." };
  }
  if (!(await getQuizForAdmin(parsed.data.lessonId))) return { ok: false, error: "QCM introuvable." };
  try {
    await saveQuizQuestions(admin.id, parsed.data.lessonId, parsed.data.questions);
  } catch (e) {
    if (e instanceof QuizError) return { ok: false, error: e.message };
    console.error("[admin-quiz]", e);
    return { ok: false, error: "Enregistrement impossible. Réessaie." };
  }
  revalidatePath("/admin");
  return { ok: true };
}
