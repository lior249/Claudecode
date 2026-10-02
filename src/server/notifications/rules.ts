// Règles pures des notifications (testées sans base de données).

export const QUIET_START_HOUR = 22; // pas de message privé de 22 h…
export const QUIET_END_HOUR = 8; // …à 8 h (heure locale), sauf urgence
export const MAX_DAILY_DMS = 3; // messages privés non urgents par jour
export const DM_STALE_MS = 16 * 3_600_000; // un message non urgent plus vieux n'est plus envoyé en privé
export const REMINDER_HOURS = { min: 8, max: 21, default: 19 };
export const DIGEST_HOUR = 9; // résumé du jour des coachs et des admins
export const STREAK_LAST_CHANCE_HOUR = 21;
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
// Relances d'un élève absent du Learn (jours sans visite), puis silence : on n'insiste pas au-delà.
export const INACTIVITY_DAYS = [1, 2, 3, 5, 7, 14];

export function localHour(date: Date, tz: string) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(date);
  return Number(h);
}

export function localWeekday(date: Date, tz: string) {
  // 1 = lundi … 7 = dimanche
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(date);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}

export const isQuietHour = (hour: number) => hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;

/** Que faire du message privé d'une notification : l'envoyer, attendre (heures calmes) ou y renoncer. */
export function dmDecision(input: { urgent: boolean; hour: number; sentToday: number; ageMs: number }): "send" | "wait" | "skip" {
  if (input.urgent) return "send";
  if (input.ageMs > DM_STALE_MS) return "skip";
  if (isQuietHour(input.hour)) return "wait";
  if (input.sentToday >= MAX_DAILY_DMS) return "skip";
  return "send";
}

/** Choix stable d'une formulation (varie d'un jour et d'un élève à l'autre, sans hasard). */
export function pick<T>(variants: readonly T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return variants[h % variants.length];
}

export function clampReminderHour(h: number) {
  if (!Number.isInteger(h)) return REMINDER_HOURS.default;
  return Math.min(REMINDER_HOURS.max, Math.max(REMINDER_HOURS.min, h));
}

// ---------- Textes (tutoiement, courts, variés) ----------

export function learnNudge(daysAway: number, lesson: string | null, seed: string) {
  const l = lesson ? `« ${lesson} »` : "ta prochaine leçon";
  if (daysAway <= 1)
    return pick(
      [
        `📚 ${l} t'attend. 10 minutes aujourd'hui, et tu avances !`,
        `👀 Petit rappel : ${l} est prête pour toi.`,
        `⚡ Un pas par jour : ${l} t'attend sur Creato.`,
      ],
      seed,
    );
  if (daysAway <= 3)
    return pick(
      [`😶 Ça fait ${daysAway} jours… ${l} t'attend toujours. On reprend ?`, `🔁 ${daysAway} jours sans te voir ! Reviens finir ${l}.`],
      seed,
    );
  if (daysAway <= 7) return `🥺 ${daysAway} jours sans toi. Ceux qui terminent le parcours sont ceux qui reviennent. ${l} t'attend.`;
  return `👋 On ne t'a pas vu depuis ${daysAway} jours. Ta place est toujours là : reprends avec ${l} quand tu veux.`;
}

export function streakRisk(current: number, seed: string) {
  if (current <= 0)
    return pick(["🔥 Poste ta vidéo du jour pour allumer ta flamme !", "🎬 Une vidéo aujourd'hui = 1er jour de ta flamme. Go !"], seed);
  return pick(
    [
      `🔥 Ta flamme de ${current} jour${current > 1 ? "s" : ""} attend ton post du jour !`,
      `⏳ N'oublie pas ton post : ta flamme est à ${current} jour${current > 1 ? "s" : ""}.`,
      `🎬 Ajoute ta vidéo du jour pour garder tes ${current} jour${current > 1 ? "s" : ""} de suite.`,
    ],
    seed,
  );
}

export const streakLastChance = (current: number) =>
  `🚨 Dernière chance : ta flamme de ${current} jour${current > 1 ? "s" : ""} s'éteint à minuit. Poste et ajoute le lien !`;

export function streakMilestone(days: number) {
  if (days >= 100) return `🏆 ${days} jours de suite ! Tu fais partie des plus réguliers. Respect.`;
  if (days >= 30) return `💎 ${days} jours de suite ! Ta régularité paie : +3 points bonus à 30 jours.`;
  return `🔥 ${days} jours de suite ! Continue comme ça.`;
}

export function coachDigest(c: { waits: number; late: number; proofs: number; reactivations: number }) {
  const parts = [
    c.waits && `${c.waits} réponse${c.waits > 1 ? "s" : ""} à donner${c.late ? ` (dont ${c.late} en retard)` : ""}`,
    c.proofs && `${c.proofs} preuve${c.proofs > 1 ? "s" : ""} à vérifier`,
    c.reactivations && `${c.reactivations} demande${c.reactivations > 1 ? "s" : ""} de réactivation`,
  ].filter(Boolean);
  return parts.length ? `☀️ Ta journée de coach : ${parts.join(", ")}.` : null;
}

export function adminDigest(c: { reviews: number; reactivations: number; withoutCoach: number; lowStarCoaches: number; failedJobs: number }) {
  const parts = [
    c.reviews && `${c.reviews} correction${c.reviews > 1 ? "s" : ""} humaine${c.reviews > 1 ? "s" : ""} à faire`,
    c.reactivations && `${c.reactivations} réactivation${c.reactivations > 1 ? "s" : ""} en attente`,
    c.withoutCoach && `${c.withoutCoach} élève${c.withoutCoach > 1 ? "s" : ""} sans coach`,
    c.lowStarCoaches && `${c.lowStarCoaches} coach${c.lowStarCoaches > 1 ? "s" : ""} à 1–2 étoiles`,
    c.failedJobs && `${c.failedJobs} tâche${c.failedJobs > 1 ? "s" : ""} en échec`,
  ].filter(Boolean);
  return parts.length ? `🛠️ Résumé admin : ${parts.join(", ")}.` : null;
}
