// Tâches programmées : la prison chaque jour à minuit UTC, le compte à rebours de la prison à 18 h,
// les annonces du soir (voir EVENING_HOUR) et les classements en direct.

import {
  RANKING_SIZES,
  challengeLaunchMessage,
  congratulations,
  dailyRankingMessage,
  monthReminderMessage,
  prisonCountdownMessage,
  prisonEntryMessages,
  prisonExitMessage,
  prisonFinalMessages,
  rankingMessage,
  weeklyRecapMessage,
  winnerMessage,
} from './messages.js';
import { announce, send } from './send.js';
import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, countdownDays } from './stats.js';
import {
  DAY_MS,
  EVENING_MS,
  PRISON_COUNTDOWN_HOUR,
  dayOf,
  eveningDay,
  lastMonthEnd,
  lastWeekEnd,
  monthName,
  monthRange,
  weekRange,
} from './time.js';

// Jours du mois où le top-30 reçoit un rappel du challenge.
const MONTH_REMINDER_DAYS = [10, 20, 25];
// Le message au gagnant part 3 minutes après la clôture.
const WINNER_MESSAGE_DELAY_MS = 3 * 60 * 1000;

export function createJobs(ctx, handlers) {
  const { config, db, tracker, guild, channels, prison } = ctx;

  // Libère les membres dont l'équipe a retiré le rôle Prisonnier pendant que le bot ne regardait pas.
  async function checkTeamReleases(today) {
    for (const userId of db.prisonRecords().keys()) {
      const member = guild.members.cache.get(userId);
      if (member && prison.wasReleasedByTeam(member)) await prison.releaseByTeam(member, today);
    }
  }

  async function runDaily(now) {
    const today = dayOf(now);
    await guild.members.fetch();
    for (const member of guild.members.cache.values()) tracker.syncCategory(member, today);
    await checkTeamReleases(today);

    const rows = tracker.snapshot(guild.members.cache, now);
    const records = db.prisonRecords();
    const entries = new Map(); // délai (15 ou 21 jours) -> membres
    const finals = [];
    const exits = [];

    for (const row of rows.values()) {
      const { userId, prison: state } = row;
      const record = records.get(userId);
      if (record) {
        if (row.chain >= DAYS_TO_LEAVE_PRISON) {
          await prison.free(row.member);
          exits.push(userId);
          continue;
        }
        if (!record.hasRole) await prison.giveRole(row.member);
        if (state.missed >= FINAL_PRISON_DAYS && record.level < FINAL_PRISON_DAYS) {
          db.setPrisonLevel(userId, FINAL_PRISON_DAYS);
          finals.push(userId);
        }
        continue;
      }
      if (state.missed >= state.limit) {
        await prison.imprison(row.member, state.limit);
        entries.set(state.limit, [...(entries.get(state.limit) ?? []), userId]);
      }
    }
    // Membres partis du serveur ou qui ont perdu leur rôle : on les oublie sans annonce.
    for (const userId of records.keys()) {
      if (!rows.has(userId)) db.removePrison(userId);
    }

    for (const [days, userIds] of [...entries].sort(([a], [b]) => a - b)) {
      for (const content of prisonEntryMessages(days, userIds, config)) await send(channels.prison, content);
    }
    for (const content of prisonFinalMessages(finals, config)) await send(channels.prison, content);
    for (const userId of exits) await send(channels.prison, prisonExitMessage(userId), [userId]);

    // Le rôle de chaîne disparaît dès qu'un jour est manqué.
    for (const member of guild.members.cache.values()) {
      const row = rows.get(member.id);
      if (row || member.roles.cache.has(config.roles.streak)) await handlers.syncStreakRole(member, row?.chain ?? 0);
    }
  }

  // Une période commencée avant le lancement du bot (semaine ou mois incomplet) n'est pas publiée.
  function startedBeforeLaunch(range) {
    return range.start < Number(db.getMeta('launch_day')) * DAY_MS;
  }

  // Fin d'un challenge : classement final, puis le rôle de la période et un message pour le gagnant Free.
  async function runRanking(kind, range, now) {
    if (startedBeforeLaunch(range)) return;
    await guild.members.fetch();
    const sections = tracker.rankings(guild.members.cache, now, range, RANKING_SIZES[kind]);
    const channel = kind === 'week' ? 'week' : 'month';
    const reward = kind === 'week' ? 'weekWinner' : 'monthWinner';

    const title = kind === 'week' ? 'Classement de la semaine' : `Classement du mois — ${monthName(range.end)}`;
    const content = rankingMessage({ kind, title, congrats: congratulations(range.start), sections, config });
    await announce(channels[channel], content);

    const freeWinner = guild.members.cache.get(sections.find((s) => s.category === 'free').entries[0]?.userId);
    if (!freeWinner) return;
    if (!freeWinner.roles.cache.has(config.roles[reward])) {
      await freeWinner.roles
        .add(config.roles[reward], 'Gagnant du classement')
        .catch((error) => console.error(`[PlugBot] Impossible de donner le rôle de gagnant :`, error.message));
    }
    db.schedule(channel, winnerMessage(reward, freeWinner.id, config), [freeWinner.id], now + WINNER_MESSAGE_DELAY_MS);
  }

  // Envoie les messages programmés dont l'heure est passée. Chacun est retiré avant l'envoi :
  // en cas d'erreur, il n'est pas envoyé deux fois.
  async function sendDueMessages(now) {
    for (const message of db.dueMessages(now)) {
      db.removeScheduled(message.id);
      try {
        await send(channels[message.channel], message.content, message.notify);
      } catch (error) {
        console.error('[PlugBot] Échec d’un message programmé :', error);
      }
    }
  }

  // Chaque jour à 18 h, dans #la-prison : chaque membre à 5 jours ou moins de la prison est mentionné,
  // avec le nombre de jours qu'il lui reste.
  async function runPrisonCountdown(now) {
    const groups = new Map(); // jours restants -> membres
    for (const row of tracker.snapshot(guild.members.cache, now).values()) {
      const daysLeft = row.prison.inPrison ? null : countdownDays(row.prison.missed, row.prison.limit);
      if (daysLeft !== null) groups.set(daysLeft, [...(groups.get(daysLeft) ?? []), row.userId]);
    }
    if (groups.size === 0) return;
    const sorted = [...groups].sort(([a], [b]) => a - b).map(([daysLeft, userIds]) => ({ daysLeft, userIds }));
    await send(channels.prison, prisonCountdownMessage(sorted, config));
  }

  // Annonce du soir dans #top-7 : venez voir votre classement, avec le premier de chaque catégorie.
  async function runDailyRanking(range, now) {
    const leaders = tracker
      .rankings(guild.members.cache, now, range, 1)
      .filter(({ entries }) => entries.length > 0)
      .map(({ category, entries }) => ({ category, userId: entries[0].userId }));
    await announce(channels.week, dailyRankingMessage({ leaders, config }));
  }

  // Publications du soir, à 20 h 30 GMT (les clôtures sont publiées à part, voir tick).
  // top-7 : lancement le lundi, « venez consulter votre classement » du mardi au samedi.
  // top-30 : lancement le 1er, rappel les 10, 20 et 25 du mois.
  // show-up : récap des récompenses le dimanche.
  // Les lancements et les rappels ne sont pas publiés pour une semaine ou un mois commencé avant
  // le lancement du bot. Les classements eux-mêmes sont en direct (voir boards.js).
  async function runEvening(day, now) {
    const date = new Date(day * DAY_MS);
    const weekday = date.getUTCDay(); // 0 = dimanche, 1 = lundi
    const dayOfMonth = date.getUTCDate();
    const evening = day * DAY_MS + EVENING_MS;

    const week = weekRange(evening);
    if (weekday === 1 && !startedBeforeLaunch(week)) {
      await announce(channels.week, challengeLaunchMessage({ kind: 'week', ...week, config }));
    } else if (weekday >= 2 && weekday <= 6) {
      await runDailyRanking(week, now);
    }

    // Le dernier jour du mois au soir, `month` est déjà le mois suivant (il démarre ce soir) :
    // la clôture suffit.
    const month = monthRange(evening);
    if (!startedBeforeLaunch(month) && evening > month.start) {
      const daysLeft = Math.round((month.end - evening) / DAY_MS);
      if (dayOfMonth === 1) {
        await announce(channels.month, challengeLaunchMessage({ kind: 'month', ...month, config }));
      } else if (MONTH_REMINDER_DAYS.includes(dayOfMonth)) {
        await announce(channels.month, monthReminderMessage({ daysLeft, end: month.end, config }));
      }
    }

    if (weekday === 0) await announce(channels.showup, weeklyRecapMessage(config));
  }

  // Lance une tâche une seule fois par période. La date est enregistrée avant l'envoi :
  // en cas d'erreur, rien n'est publié deux fois.
  async function once(key, value, label, task) {
    if (Number(db.getMeta(key)) >= value) return;
    db.setMeta(key, value);
    try {
      await task();
    } catch (error) {
      console.error(`[PlugBot] Échec : ${label}.`, error);
    }
  }

  // Appelée chaque minute. Rattrape aussi une publication manquée pendant une coupure
  // (le compte à rebours de la prison, seulement le jour même).
  async function tick() {
    const now = Date.now();
    const today = dayOf(now);
    await once('last_daily_day', today, 'vérification de la prison', () => runDaily(now));

    const weekEnd = lastWeekEnd(now);
    await once('last_week_boundary', weekEnd, 'classement de la semaine', () =>
      runRanking('week', weekRange(weekEnd - 1), now),
    );

    const monthEnd = lastMonthEnd(now);
    await once('last_month_boundary', monthEnd, 'classement du mois', () =>
      runRanking('month', monthRange(monthEnd - 1), now),
    );

    if (now >= today * DAY_MS + PRISON_COUNTDOWN_HOUR * 60 * 60 * 1000) {
      await once('last_prison_countdown_day', today, 'compte à rebours de la prison', () => runPrisonCountdown(now));
    }

    const evening = eveningDay(now);
    await once('last_evening_day', evening, 'publications du soir', () => runEvening(evening, now));

    await sendDueMessages(now);
    // En dernier : le classement en direct repasse sous les messages publiés juste avant.
    await ctx.boards?.refresh(now);

    if (ctx.eventService) {
      try {
        await ctx.eventService.tick(now);
      } catch (error) {
        console.error('[PlugBot] Échec : planification des événements.', error);
      }
    }
  }

  return { tick, runDaily, runRanking, runEvening, runPrisonCountdown, checkTeamReleases };
}
