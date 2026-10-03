import { requireUser } from "@/server/auth/session";
import { listReactivationRequests } from "@/server/coaching/admin";
import { ReactivationDecision } from "@/components/coaching/reactivation-decision";
import { MascotState } from "@/components/mascot";

export default async function CoachReactivations() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const requests = await listReactivationRequests(user);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Demandes de retour</h1>
        <p className="mt-1 text-sm text-muted">Élèves en pause après 7 jours sans post qui demandent à reprendre leur coaching.</p>
      </div>
      {requests.length === 0 && (
        <MascotState mood="content">
          Aucune demande.
        </MascotState>
      )}
      {requests.map((r) => (
        <section key={r.id} className="rounded-3xl border border-line bg-card p-4">
          <p className="font-semibold">{r.learner.displayName}</p>
          <p className="text-xs text-muted">Demande du {r.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
          <p className="mt-2 whitespace-pre-line text-sm">{r.reason}</p>
          <ReactivationDecision requestId={r.id} />
        </section>
      ))}
    </div>
  );
}
