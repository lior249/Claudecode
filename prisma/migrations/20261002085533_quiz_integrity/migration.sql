-- Une seule tentative de QCM ouverte à la fois par élève et par leçon.
CREATE UNIQUE INDEX "QuizAttempt_one_open_per_lesson" ON "QuizAttempt" ("userId", "lessonId") WHERE "completedAt" IS NULL;
-- Un score de QCM est compris entre 0 et le nombre de questions.
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= "totalQuestions"));
