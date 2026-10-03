import { requireUser } from "@/server/auth/session";
import { listPendingProofs } from "@/server/coaching/progress";
import { ProofReview } from "@/components/coaching/proof-review";
import { listPendingResultPosts } from "@/server/results/service";
import { ResultPostReview } from "@/components/results/result-post-review";

const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-FR"));

export default async function CoachProofs() {
  const user = await requireUser(["COACH", "ADMIN"]);
  const { views, ranks } = await listPendingProofs(user);
  const posts = await listPendingResultPosts(user);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Preuves à valider</h1>
      {views.length + ranks.length + posts.length === 0 && <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted">Rien à valider. 🎉</p>}
      {ranks.map((r) => (
        <ProofReview
          key={r.id}
          kind="rank"
          id={r.id}
          learner={r.learner}
          imageUrl={r.imageUrl}
          title={r.kind === "MONTHLY" ? `Résultats de ${r.month} : ${r.amountEur} €` : `${r.followers?.toLocaleString("fr-FR")} abonnés (rang A)`}
          hint={
            r.kind === "MONTHLY"
              ? "Ouvre chaque vidéo : les vues et l'activité doivent coller avec le montant déclaré. 100 € = S · 500 € = SS · 1 000 € = SSS (fin du coaching)."
              : "Ouvre le profil : le nom d'utilisateur et le nombre d'abonnés doivent correspondre à la capture."
          }
          declared={r.kind === "MONTHLY" ? [{ label: "Gains déclarés", value: `${r.amountEur} €` }] : [{ label: "Abonnés déclarés", value: fr(r.followers) }]}
          links={
            r.kind === "MONTHLY"
              ? r.videoUrls.map((url, i) => ({ label: `Vidéo ${i + 1}`, url }))
              : r.profileUrl
                ? [{ label: "Profil TikTok", url: r.profileUrl }]
                : []
          }
        />
      ))}
      {views.map((v) => (
        <ProofReview
          key={v.id}
          kind="views"
          id={v.id}
          learner={v.learner}
          imageUrl={v.imageUrl}
          title={`${fr(v.views)} vues déclarées`}
          hint="Ouvre la vidéo : vues, j'aime et commentaires doivent correspondre à la capture."
          declared={[
            { label: "Vues", value: fr(v.views) },
            { label: "J'aime", value: fr(v.likes) },
            { label: "Commentaires", value: fr(v.comments) },
          ]}
          links={[{ label: "Ouvrir la vidéo", url: v.url }]}
          views={v.views}
        />
      ))}
      {posts.map((p) => (
        <ResultPostReview key={p.id} id={p.id} author={`${p.author}${p.authorRole === "COACH" ? " (coach)" : ""}`} title={p.title} body={p.body} link={p.link} imageUrl={p.imageUrl} />
      ))}
    </div>
  );
}
