import { requireUser } from "@/server/auth/session";
import { listPendingResults } from "@/server/results/service";
import { ResultPostReview } from "@/components/results/result-post-review";
import { MascotState } from "@/components/mascot";

// Résultats que l'IA n'a pas validés (ou n'a pas pu lire) : le coach (ou l'admin) publie ou refuse.
export default async function CoachResultsReview() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const posts = await listPendingResults(user);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Résultats à vérifier</h1>
      {posts.length === 0 && (
        <MascotState mood="content" title="Tout est à jour">
          Rien à vérifier : l&apos;IA a validé les dernières captures.
        </MascotState>
      )}
      {posts.map((p) => (
        <ResultPostReview key={p.id} p={{ ...p, author: `${p.author}${p.authorRole === "COACH" ? " (coach)" : p.authorRole === "ADMIN" ? " (admin)" : ""}` }} />
      ))}
    </div>
  );
}
