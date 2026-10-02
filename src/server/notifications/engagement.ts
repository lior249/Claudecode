import "server-only";
import { prisma } from "@/server/db";
import { getLearnerProgression } from "@/server/learn/service";
import { getStreak, leaderboard } from "@/server/coaching/progress";
import { daysBetween, localDate, monthlyWindow } from "@/server/coaching/rules";
import { listReactivationRequests } from "@/server/coaching/admin";
import { notify, userTimezone } from "./service";
import {
  DIGEST_HOUR,
  INACTIVITY_DAYS,
  QUIET_START_HOUR,
  STREAK_LAST_CHANCE_HOUR,
  adminDigest,
  coachDigest,
  learnNudge,
  localHour,
  localWeekday,
  streakLastChance,
  streakRisk,
} from "./rules";

// Relances façon Duolingo, lancées par le worker toutes les 5 minutes.
// Chaque relance a une clé unique (onceKey) : relancer la fonction ne crée jamais de doublon.
export async function runEngagement(now = new Date()) {
  let created = 0;
  const count: Counter = (n) => {
    if (n) created++;
  };
  await learnNudges(now, count);
  await coachingNudges(now, count);
  await staffDigests(now, count);
  return created;
}

type Counter = (n: unknown) => void;

const dayBefore = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Élèves du Learn : un rappel à leur heure s'ils ne sont pas venus aujourd'hui, de plus en plus espacé.
async function learnNudges(now: Date, count: Counter) {
  const learners = await prisma.user.findMany({
    where: { role: "LEARNER", status: "ACTIVE", learnStartedAt: { not: null }, learnCompletedAt: null },
    select: { id: true, timezone: true, reminderHour: true, lastSeenAt: true, learnStartedAt: true },
  });
  for (const l of learners) {
    const tz = userTimezone(l);
    const hour = localHour(now, tz);
    if (hour < l.reminderHour || hour >= QUIET_START_HOUR) continue;
    const today = localDate(now, tz);
    const away = daysBetween(localDate(l.lastSeenAt ?? l.learnStartedAt!, tz), today);
    if (!INACTIVITY_DAYS.includes(away)) continue;
    const { progression } = await getLearnerProgression(l.id, now, { startClock: false });
    const current = progression.levels.flatMap((x) => x.modules.flatMap((m) => m.lessons)).find((x) => x.id === progression.currentLessonId);
    count(await notify(l.id, { kind: "learn.nudge", href: "/learn", onceKey: `learn-nudge:${today}`, text: learnNudge(away, current?.title ?? null, `${l.id}${today}`) }));
  }
}

// Élèves en coaching : flamme en danger, dernière chance, gel utilisé, classement de la semaine, résultats du mois.
async function coachingNudges(now: Date, count: Counter) {
  const learners = await prisma.user.findMany({
    where: { role: "LEARNER", status: "ACTIVE", coachingStatus: "ACTIVE", tiktokUsername: { not: null } },
    select: { id: true, timezone: true, reminderHour: true },
  });
  let board: Awaited<ReturnType<typeof leaderboard>> | null = null;
  for (const l of learners) {
    const tz = userTimezone(l);
    const hour = localHour(now, tz);
    const today = localDate(now, tz);
    const yesterday = dayBefore(today);
    const streak = await getStreak(l.id, now);

    if (streak.frozenDays.includes(yesterday)) {
      count(await notify(l.id, { kind: "streak.freeze", href: "/coaching", onceKey: `freeze:${yesterday}`, text: "🧊 Ton gel a protégé ta flamme hier. Il te reste à poster aujourd'hui pour la garder !" }));
    }
    const awake = hour >= l.reminderHour && hour < QUIET_START_HOUR;
    if (awake && !streak.todayDone) {
      count(await notify(l.id, { kind: "streak.risk", href: "/coaching", onceKey: `streak-risk:${today}`, text: streakRisk(streak.current, `${l.id}${today}`) }));
    }
    if (hour === STREAK_LAST_CHANCE_HOUR && l.reminderHour < STREAK_LAST_CHANCE_HOUR && !streak.todayDone && streak.current > 0) {
      count(await notify(l.id, { kind: "streak.lastChance", href: "/coaching", onceKey: `streak-last:${today}`, text: streakLastChance(streak.current) }));
    }
    if (awake && localWeekday(now, tz) === 1) {
      board ??= await leaderboard(now);
      const pos = board.findIndex((r) => r.id === l.id);
      if (pos >= 0) {
        const me = board[pos];
        const text =
          pos < 3
            ? `${["🥇", "🥈", "🥉"][pos]} Tu es ${pos === 0 ? "1er" : `${pos + 1}e`} du classement avec ${me.points} points. Garde ta place cette semaine !`
            : `🏆 Nouvelle semaine : tu es ${pos + 1}e avec ${me.points} points. Il te manque ${board[pos - 1].points - me.points + 1} point(s) pour passer devant.`;
        count(await notify(l.id, { kind: "leaderboard.weekly", href: "/classement", onceKey: `weekly:${today}`, text }));
      }
    }
    const win = monthlyWindow(today);
    if (awake && win.open && win.month) {
      const sent = await prisma.rankProof.count({ where: { learnerId: l.id, kind: "MONTHLY", month: win.month } });
      if (!sent) {
        const day = Number(today.slice(8, 10));
        if (day > 5) {
          count(await notify(l.id, { kind: "monthly.open", href: "/coaching", onceKey: `monthly-open:${win.month}`, text: "💰 C'est le dernier jour du mois : envoie tes résultats (montant, capture et liens des vidéos) jusqu'au 5." }));
        } else if (day >= 4) {
          count(await notify(l.id, { kind: "monthly.last", href: "/coaching", onceKey: `monthly-last:${win.month}`, text: `⏳ Plus que ${6 - day} jour${6 - day > 1 ? "s" : ""} pour envoyer tes résultats du mois.` }));
        }
      }
    }
  }
}

// Coachs et admins : un résumé chaque matin, seulement s'il y a quelque chose à faire.
async function staffDigests(now: Date, count: Counter) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["COACH", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, role: true, timezone: true },
  });
  for (const s of staff) {
    const tz = userTimezone(s);
    if (localHour(now, tz) < DIGEST_HOUR || localHour(now, tz) >= QUIET_START_HOUR) continue;
    const today = localDate(now, tz);
    const coachText = coachDigest({
      waits: await prisma.responseWait.count({ where: { coachId: s.id, answeredAt: null } }),
      late: await prisma.responseWait.count({ where: { coachId: s.id, answeredAt: null, dueAt: { lt: now } } }),
      proofs:
        (await prisma.viewProof.count({ where: { status: "PENDING", post: { learner: { coachId: s.id } } } })) +
        (await prisma.rankProof.count({ where: { status: "PENDING", learner: { coachId: s.id } } })),
      reactivations: s.role === "ADMIN" ? 0 : (await listReactivationRequests(s)).length,
    });
    if (coachText) count(await notify(s.id, { kind: "coach.digest", href: "/coach", onceKey: `coach-digest:${today}`, text: coachText }));
    if (s.role !== "ADMIN") continue;
    const adminText = adminDigest({
      reviews: await prisma.submission.count({ where: { status: "PENDING_HUMAN" } }),
      reactivations: await prisma.reactivationRequest.count({ where: { status: "PENDING" } }),
      withoutCoach: await prisma.user.count({ where: { role: "LEARNER", coachingStatus: "ACTIVE", coachId: null } }),
      lowStarCoaches: await prisma.user.count({ where: { role: { in: ["COACH", "ADMIN"] }, coachOrder: { not: null }, coachStars: { lte: 2 } } }),
      failedJobs: await prisma.job.count({ where: { status: "FAILED", finishedAt: { gte: new Date(now.getTime() - 86_400_000) } } }),
    });
    if (adminText) count(await notify(s.id, { kind: "admin.digest", href: "/admin", onceKey: `admin-digest:${today}`, text: adminText }));
  }
}
