import { ReviewDetail } from "@/components/admin/review-views";

export default async function AdminReview({ params }: PageProps<"/admin/reviews/[id]">) {
  return <ReviewDetail id={(await params).id} base="/admin/reviews" />;
}
