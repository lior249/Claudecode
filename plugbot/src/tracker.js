// Relie la base de données aux membres du serveur : catégorie, chaîne, prison, points.

import { DAYS_TO_LEAVE_PRISON, PRISON_DAYS, chainLength, leaderboard, missedDays, trackingStartDay } from './stats.js';
import { dayOf, weekRange } from './time.js';

// L'accompagnement est toujours affiché avant les Free.
const CATEGORIES = ['plug', 'free'];

export function createTracker({ config, db }) {
  function categoryOf(member) {
    if (member.roles.cache.has(config.roles.plug)) return 'plug';
    if (member.roles.cache.has(config.roles.free)) return 'free';
    return null;
  }

  // Les bots, les admins et les membres sans rôle Free ni @TikTok ne sont pas suivis.
  function isTracked(member) {
    return !member.user.bot && !config.adminIds.has(member.id) && categoryOf(member) !== null;
  }

  // Note la catégorie du membre. Quand elle change (rôle @TikTok ou Free gagné ou perdu),
  // le compteur de la prison repart de zéro.
  function syncCategory(member, today) {
    const category = isTracked(member) ? categoryOf(member) : null;
    const state = db.getMemberState(member.id);
    if ((state?.category ?? null) === category) return;
    db.setMemberState(member.id, category, category ? today : (state?.resetDay ?? null));
  }

  // Une ligne par membre suivi, calculée à l'instant `now`.
  // `points` compte les show-ups de la période `range` (par défaut, la semaine en cours).
  function snapshot(members, now, range = weekRange(now)) {
    const today = dayOf(now);
    const launchDay = Number(db.getMeta('launch_day'));
    const days = db.validDays();
    const states = db.memberStates();
    const prisoners = db.prisonRecords();
    const totals = db.totals();
    const counts = db.countsBetween(range.start, range.end);
    const rows = new Map();
    for (const member of members.values()) {
      if (!isTracked(member)) continue;
      const category = categoryOf(member);
      const memberDays = days.get(member.id) ?? new Set();
      const chain = chainLength(memberDays, today);
      const startDay = trackingStartDay(member.joinedTimestamp, launchDay, states.get(member.id)?.resetDay);
      const inPrison = prisoners.has(member.id);
      rows.set(member.id, {
        userId: member.id,
        member,
        category,
        chain,
        prison: {
          inPrison,
          missed: missedDays(memberDays, startDay, today),
          limit: PRISON_DAYS[category],
          daysToLeave: inPrison ? Math.max(0, DAYS_TO_LEAVE_PRISON - chain) : 0,
        },
        total: totals.get(member.id)?.count ?? 0,
        points: counts.get(member.id)?.count ?? 0,
        pointsReachedAt: counts.get(member.id)?.reachedAt ?? 0,
      });
    }
    return rows;
  }

  // Les classements de la période `range` : les `size` premiers de chaque catégorie, l'accompagnement d'abord.
  function rankings(members, now, range, size) {
    const rows = [...snapshot(members, now, range).values()];
    return CATEGORIES.map((category) => ({ category, entries: leaderboard(rows, category).slice(0, size) }));
  }

  return { categoryOf, isTracked, syncCategory, snapshot, rankings };
}
