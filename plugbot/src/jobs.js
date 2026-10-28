// Tâches programmées : la prison chaque jour à minuit UTC, et les classements à 19 h 45 UTC (GMT).

import {
  RANKING_SIZES,
  allTimeMessage,
  challengeLaunchMessage,
  congratulations,
  monthReminderMessage,
  prisonEntryMessages,
  prisonExitMessage,
  prisonFinalMessages,
  prisonWarningMessages,
  rankingMessage,
  standingsMessage,
  weeklyRecapMessage,
  winnerMessage,
} from './messages.js';
import { announce, send } from './send.js';
import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, leaderboard, needsWarning } from './stats.js';
import {
  ALL_TIME,
  DAY_MS,
  EVENING_MS,
  dayOf,
  eveningDay,
  lastMonthEnd,
  lastWeekEnd,
  monthName,
  monthRange,
  weekRange,
} from './time.js';

// L'accompagnement est toujours affiché avant les Free.
const CATEGORIES = ['plug', 'free'];
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
    const alerts = db.alertDays();
    const warnings = [];
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
        continue;
      }
      if (needsWarning(state.missed, state.limit, today, alerts.get(userId))) {
        db.setAlert(userId, today);
        warnings.push(userId);
      }
    }
    // Membres partis du serveur ou qui ont perdu leur rôle : on les oublie sans annonce.
    for (const userId of records.keys()) {
      if (!rows.has(userId)) db.removePrison(userId);
    }

    for (const content of prisonWarningMessages(warnings, config)) await send(channels.prison, content);
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

  // Les listes de chaque catégorie, l'accompagnement d'abord.
  async function sectionsFor(range, now, size) {
    await guild.members.fetch();
    const rows = [...tracker.snapshot(guild.members.cache, now, range).values()];
    return CATEGORIES.map((category) => ({ category, entries: leaderboard(rows, category).slice(0, size) }));
  }

  // Fin d'un challenge : classement final, puis le rôle de la période et un message pour le gagnant Free.
  async function runRanking(kind, range, now) {
    if (startedBeforeLaunch(range)) return;
    const sections = await sectionsFor(range, now, RANKING_SIZES[kind]);
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

  // Point d'étape d'un challenge en cours, au soir `evening`.
  async function runStandings(kind, range, evening, now) {
    const sections = await sectionsFor(range, now, RANKING_SIZES[kind]);
    const daysLeft = Math.round((range.end - evening) / DAY_MS);
    const content = standingsMessage({ kind, sections, daysLeft, end: range.end, config });
    await announce(kind === 'week' ? channels.week : channels.month, content);
  }

  async function runAllTime(now) {
    if (!channels.allTime) return;
    const sections = await sectionsFor(ALL_TIME, now, RANKING_SIZES.allTime);
    await announce(channels.allTime, allTimeMessage({ sections }));
  }

  // Publications de 19 h 45 UTC (les clôtures sont publiées à part, voir tick).
  // top-7 : lancement le lundi, classement du jour du mardi au samedi.
  // top-30 : lancement le 1er, classement le dimanche, rappel les 10, 20 et 25 du mois.
  // top-all-time et récap des récompenses dans show-up : le dimanche.
  // Rien n'est publié pour une semaine ou un mois commencé avant le lancement du bot.
  async function runEvening(day, now) {
    const date = new Date(day * DAY_MS);
    const weekday = date.getUTCDay(); // 0 = dimanche, 1 = lundi
    const dayOfMonth = date.getUTCDate();
    const evening = day * DAY_MS + EVENING_MS;

    const week = weekRange(evening);
    if (!startedBeforeLaunch(week)) {
      if (weekday === 1) {
        await announce(channels.week, challengeLaunchMessage({ kind: 'week', ...week, config }));
      } else if (weekday >= 2 && weekday <= 6) {
        await runStandings('week', week, evening, now);
      }
    }

    // Le dernier jour du mois au soir, `month` est déjà le mois suivant (il démarre ce soir) :
    // la clôture suffit.
    const month = monthRange(evening);
    if (!startedBeforeLaunch(month) && evening > month.start) {
      const daysLeft = Math.round((month.end - evening) / DAY_MS);
      if (dayOfMonth === 1) {
        await announce(channels.month, challengeLaunchMessage({ kind: 'month', ...month, config }));
      } else if (weekday === 0) {
        await runStandings('month', month, evening, now);
      } else if (MONTH_REMINDER_DAYS.includes(dayOfMonth)) {
        await announce(channels.month, monthReminderMessage({ daysLeft, end: month.end, config }));
      }
    }

    if (weekday === 0) {
      await runAllTime(now);
      await announce(channels.showup, weeklyRecapMessage(config));
    }
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

  // Appelée chaque minute. Rattrape aussi une publication manquée pendant une coupure.
  async function tick() {
    const now = Date.now();
    await once('last_daily_day', dayOf(now), 'vérification de la prison', () => runDaily(now));

    const weekEnd = lastWeekEnd(now);
    await once('last_week_boundary', weekEnd, 'classement de la semaine', () =>
      runRanking('week', weekRange(weekEnd - 1), now),
    );

    const monthEnd = lastMonthEnd(now);
    await once('last_month_boundary', monthEnd, 'classement du mois', () =>
      runRanking('month', monthRange(monthEnd - 1), now),
    );

    const evening = eveningDay(now);
    await once('last_evening_day', evening, 'publications du soir', () => runEvening(evening, now));

    await sendDueMessages(now);
  }

  return { tick, runDaily, runRanking, runEvening, checkTeamReleases };
}
