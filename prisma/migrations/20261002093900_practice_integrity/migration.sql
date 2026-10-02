-- Une seule soumission en cours d'analyse à la fois par élève et par leçon (anti double envoi).
CREATE UNIQUE INDEX "Submission_one_processing_per_lesson" ON "Submission" ("userId", "lessonId") WHERE "status" = 'PROCESSING';
-- Note sur 10.
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_score_range" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10));
