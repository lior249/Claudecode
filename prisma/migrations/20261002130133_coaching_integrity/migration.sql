-- Un seul ticket de suivi (ouvert par le coach) ouvert à la fois par élève.
CREATE UNIQUE INDEX "Ticket_one_open_coach_ticket" ON "Ticket" ("learnerId") WHERE "origin" = 'COACH' AND "status" = 'OPEN';
-- Une seule attente de réponse en cours par ticket.
CREATE UNIQUE INDEX "ResponseWait_one_open_per_ticket" ON "ResponseWait" ("ticketId") WHERE "answeredAt" IS NULL;
-- Étoiles d'un coach entre 1 et 6.
ALTER TABLE "User" ADD CONSTRAINT "User_coach_stars_range" CHECK ("coachStars" BETWEEN 1 AND 6);
