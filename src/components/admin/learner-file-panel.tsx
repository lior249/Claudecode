import Link from "next/link";
import { AlertTriangle, Check, Clock, Lock, X } from "lucide-react";
import type { LearnerFile } from "@/server/admin/learner-file";
import { LESSON_TYPES, RankBadge, TypeBadge } from "@/components/learn/badges";

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

// Fiche d'un élève en panneau latéral (plein écran sur téléphone).
export function LearnerFilePanel({ file, closeHref, extra }: { file: LearnerFile; closeHref: string; extra?: React.ReactNode }) {
  const u = file.user;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60">
      <Link href={closeHref} scroll={false} className="hidden flex-1 sm:block" aria-label="Fermer la fiche" />
      <aside className="h-full w-full overflow-y-auto border-l border-line bg-bg p-5 sm:max-w-xl" aria-label={`Fiche de ${u.displayName}`}>
        <div className="flex items-start gap-4">
          <RankBadge rank={file.rank} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 break-words leading-snug text-xl font-semibold">{u.displayName}</h2>
            <p className="text-sm text-muted">
              {u.discordUsername ? `@${u.discordUsername} · ` : ""}Rang {file.rank} · coach : {u.coachName ?? "—"}
            </p>
          </div>
          <Link href={closeHref} scroll={false} className="rounded-full bg-card p-2 text-muted" aria-label="Fermer">
            <X size={16} />
          </Link>
        </div>

        <section className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label="Progression" value={`${file.percent}%`} />
          <Stat label="Leçons" value={`${file.completedLessons}/${file.totalLessons}`} />
          <Stat label="Décrochages" value={String(file.lateRemarks.length)} danger={file.lateRemarks.length > 0} />
        </section>
        <p className="mt-3 text-xs text-muted">
          Inscrit le {date(u.createdAt)} · Learn commencé le {date(u.learnStartedAt)}
          {u.learnCompletedAt && ` · terminé le ${date(u.learnCompletedAt)}`}
          {u.eliteGrantedAt && " · rôle @Élite donné"}
        </p>

        {extra}

        {file.lateRemarks.length > 0 && (
          <Section title="Décrochages">
            <ul className="space-y-2">
              {file.lateRemarks.map((r, i) => (
                <li key={i} className="flex gap-2 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {r.text}. Précisément <strong>{r.duration}</strong>
                    {r.ongoing ? " (toujours en cours)" : ""} — du {date(r.from)} au {date(r.to)}.
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Leçons">
          <ul className="space-y-2">
            {file.lessons.map((l) => (
              <li key={l.id} className="rounded-2xl border border-line bg-card p-3 text-sm">
                <div className="flex items-center gap-3">
                  <TypeBadge type={l.type} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.title}</p>
                    <p className="truncate text-xs text-muted">
                      {l.module} · {LESSON_TYPES[l.type].label}
                    </p>
                  </div>
                  {l.status === "COMPLETED" ? (
                    <Check size={16} className="text-success" />
                  ) : l.status === "AVAILABLE" ? (
                    <Clock size={16} className="text-gold" />
                  ) : (
                    <Lock size={14} className="text-muted" />
                  )}
                </div>
                {l.status !== "LOCKED" && (
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    <p>
                      {[
                        l.attempts > 0 && `${l.attempts} essai${l.attempts > 1 ? "s" : ""}`,
                        l.scores.length > 0 && `notes : ${l.scores.join(", ")}`,
                        l.duration && `validé en ${l.duration}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {l.missedCriteria.map((c) => (
                      <p key={c.instruction} className="text-danger">
                        Raté {c.count} fois : {c.instruction}
                      </p>
                    ))}
                    {l.waitingHuman && <p className="text-gold">Attend une correction humaine</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Choix (niveau 2)">
          {file.decisions.length === 0 ? (
            <p className="text-sm text-muted">Aucun choix pour l&apos;instant.</p>
          ) : (
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              {file.decisions.map((d) => (
                <div key={d.catalog} className="contents">
                  <dt className="text-muted">{d.catalog}</dt>
                  <dd className="font-medium">{d.title}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section title="Ressenti (niveau 3)">
          {!file.launch ? (
            <p className="text-sm text-muted">Pas encore envoyé.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {file.launch.answers.map((a, i) => (
                <div key={i}>
                  <p className="text-muted">{a.question}</p>
                  <p className="mt-0.5 whitespace-pre-line">{a.answer}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </aside>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-card p-3">
      <p className={`text-xl font-bold ${danger ? "text-danger" : ""}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}
