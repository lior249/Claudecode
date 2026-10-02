import { requireUser } from "@/server/auth/session";
import { listPendingProofs } from "@/server/coaching/progress";
import { ProofReview } from "@/components/coaching/proof-review";

export default async function CoachProofs() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const { views, ranks } = await listPendingProofs(user);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Preuves à valider</h1>
      {views.length + ranks.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Rien à valider. 🎉</p>}
      {ranks.map((r) => (
        <ProofReview
          key={r.id}
          kind="rank"
          id={r.id}
          learner={r.learner}
          imageUrl={r.imageUrl}
          title={r.kind === "MONTHLY" ? `Résultats de ${r.month} : ${r.amountEur} €` : `${r.followers?.toLocaleString("fr-FR")} abonnés (rang A)`}
          hint={r.kind === "MONTHLY" ? "100 € = S · 500 € = SS · 1 000 € = SSS (fin du coaching)" : "Vérifie que le nom d'utilisateur est visible."}
        />
      ))}
      {views.map((v) => (
        <ProofReview key={v.id} kind="views" id={v.id} learner={v.learner} imageUrl={v.imageUrl} title={`${v.views.toLocaleString("fr-FR")} vues`} hint={v.url} views={v.views} />
      ))}
    </div>
  );
}
