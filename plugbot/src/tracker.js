// Relie la base de données aux membres du serveur : catégorie, chaîne, prison, points.

import { chainLength, prisonState, trackingStartDay } from './stats.js';
import { dayOf, weekRange } from './time.js';

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

  // Une ligne par membre suivi, calculée à l'instant `now`.
  // `week` permet de calculer les points d'une semaine précise (par défaut, la semaine en cours).
  function snapshot(members, now, week = weekRange(now)) {
    const today = dayOf(now);
    const launchDay = Number(db.getMeta('launch_day'));
    const days = db.validDays();
    const totals = db.totals();
    const weekly = db.countsBetween(week.start, week.end);
    const rows = new Map();
    for (const member of members.values()) {
      if (!isTracked(member)) continue;
      const memberDays = days.get(member.id) ?? new Set();
      rows.set(member.id, {
        userId: member.id,
        member,
        category: categoryOf(member),
        chain: chainLength(memberDays, today),
        prison: prisonState(memberDays, trackingStartDay(member.joinedTimestamp, launchDay), today),
        total: totals.get(member.id)?.count ?? 0,
        totalReachedAt: totals.get(member.id)?.reachedAt ?? 0,
        week: weekly.get(member.id)?.count ?? 0,
        weekReachedAt: weekly.get(member.id)?.reachedAt ?? 0,
      });
    }
    return rows;
  }

  return { categoryOf, isTracked, snapshot };
}
