import { ReviewList } from "@/components/admin/review-views";

// Les coachs corrigent aussi les exercices pratiques (pendant la formation, l'élève n'a pas encore de coach).
export default function CoachExercises() {
  return <ReviewList base="/coach/exercises" />;
}
