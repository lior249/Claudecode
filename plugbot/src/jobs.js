// Tâches programmées : la prison chaque jour à minuit UTC, les éloges chaque dimanche à 18 h UTC.

import { send } from './handlers.js';
import { congratulations, elogesMessage, prisonExitMessage, prisonLevelMessages } from './messages.js';
import {
  PRISON_LEVELS,
  allTimeLeaderboard,
  prisonLeaderboard,
  prisonLevel,
  weeklyLeaderboard,
} from './stats.js';
import { WEEK_MS, dayOf, weekStart } from './time.js';

const TOP_SIZE = 10;

export function createJobs(ctx, handlers) {
  const { config, db, tracker, guild, channels } = ctx;

  async function runDaily(now) {
    await guild.members.fetch();
    const rows = tracker.snapshot(guild.members.cache, now);
    const announced = db.prisonLevels();
    const newLevels = new Map(PRISON_LEVELS.map((level) => [level, []]));
    const released = [];

    for (const row of rows.values()) {
      const current = announced.get(row.userId);
      if (row.prison.inPrison) {
        const level = Math.max(prisonLevel(row.prison.missed), current === undefined ? PRISON_LEVELS[0] : 0);
        if (current === undefined || level > current) {
          db.setPrisonLevel(row.userId, level);
          newLevels.get(level).push(row.userId);
        }
      } else if (current !== undefined) {
        db.removePrison(row.userId);
        released.push(row.userId);
      }
    }
    // Membres partis du serveur ou qui ont perdu leur rôle : on les retire sans annonce.
    for (const userId of announced.keys()) {
      if (!rows.has(userId)) db.removePrison(userId);
    }

    for (const [level, userIds] of newLevels) {
      for (const content of prisonLevelMessages(level, userIds)) await send(channels.prison, content);
    }
    for (const userId of released) await send(channels.prison, prisonExitMessage(userId), [userId]);

    for (const row of rows.values()) await handlers.syncStreakRole(row.member, row.chain);
    if (config.roles.streak) {
      for (const member of guild.members.cache.values()) {
        if (!rows.has(member.id) && member.roles.cache.has(config.roles.streak)) {
          await handlers.syncStreakRole(member, 0);
        }
      }
    }
  }

  // Publie les classements de la semaine [start, end) dans les deux salons d'éloges.
  async function runWeekly(start, end, now) {
    await guild.members.fetch();
    const rows = [...tracker.snapshot(guild.members.cache, now, { start, end }).values()];
    const today = dayOf(now);
    const targets = [
      ['free', channels.elogesFree],
      ['plug', channels.elogesPlug],
    ];
    for (const [category, channel] of targets) {
      const content = elogesMessage({
        category,
        congrats: congratulations(start),
        weekly: weeklyLeaderboard(rows, category).slice(0, TOP_SIZE),
        allTime: allTimeLeaderboard(rows, category).slice(0, TOP_SIZE),
        prison: prisonLeaderboard(rows, category, today).slice(0, TOP_SIZE),
      });
      await send(channel, content);
    }
  }

  // Appelée chaque minute. Rattrape aussi une publication manquée pendant une coupure.
  // La date est enregistrée avant l'envoi : en cas d'erreur, on ne publie pas deux fois.
  async function tick() {
    const now = Date.now();

    const today = dayOf(now);
    if (Number(db.getMeta('last_daily_day')) < today) {
      db.setMeta('last_daily_day', today);
      try {
        await runDaily(now);
      } catch (error) {
        console.error('[PlugBot] Échec de la vérification quotidienne :', error);
      }
    }

    const boundary = weekStart(now);
    if (Number(db.getMeta('last_week_boundary')) < boundary) {
      db.setMeta('last_week_boundary', boundary);
      try {
        await runWeekly(boundary - WEEK_MS, boundary, now);
      } catch (error) {
        console.error('[PlugBot] Échec de la publication des éloges :', error);
      }
    }
  }

  return { tick, runDaily, runWeekly };
}
