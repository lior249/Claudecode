import { ReviewDetail } from "@/components/admin/review-views";

export default async function CoachExercise({ params }: PageProps<"/coach/exercises/[id]">) {
  return <ReviewDetail id={(await params).id} base="/coach/exercises" />;
}
