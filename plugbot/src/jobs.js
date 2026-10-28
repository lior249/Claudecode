// Tâches programmées : la prison chaque jour à minuit UTC, le top-7 chaque dimanche à 18 h UTC,
// le top-30 le dernier jour du mois à 18 h UTC.

import {
  congratulations,
  prisonEntryMessages,
  prisonExitMessage,
  prisonFinalMessages,
  prisonWarningMessages,
  rankingMessage,
} from './messages.js';
import { send } from './send.js';
import { DAYS_TO_LEAVE_PRISON, FINAL_PRISON_DAYS, leaderboard, needsWarning } from './stats.js';
import { DAY_MS, dayOf, monthName, monthRange, monthStart, weekRange, weekStart } from './time.js';

// L'accompagnement est toujours affiché avant les Free.
const CATEGORIES = ['plug', 'free'];
const RANKING_SIZES = { week: 5, month: 10 };

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

  // Publie le classement de la période [range.start, range.end) et donne le rôle aux gagnants.
  // Une période commencée avant le lancement du bot (semaine ou mois incomplet) n'est pas publiée.
  async function runRanking(kind, range, now) {
    if (range.start < Number(db.getMeta('launch_day')) * DAY_MS) return;
    await guild.members.fetch();
    const rows = [...tracker.snapshot(guild.members.cache, now, range).values()];
    const sections = CATEGORIES.map((category) => ({
      category,
      entries: leaderboard(rows, category).slice(0, RANKING_SIZES[kind]),
    }));
    // Seul le gagnant Free reçoit le rôle (et sa réduction sur la formation).
    const freeWinner = guild.members.cache.get(sections.find((s) => s.category === 'free').entries[0]?.userId);
    const roleId = kind === 'week' ? config.roles.weekWinner : config.roles.monthWinner;
    if (freeWinner && !freeWinner.roles.cache.has(roleId)) {
      await freeWinner.roles
        .add(roleId, 'Gagnant du classement')
        .catch((error) => console.error(`[PlugBot] Impossible de donner le rôle de gagnant :`, error.message));
    }

    const title = kind === 'week' ? 'Classement de la semaine' : `Classement du mois — ${monthName(range.end)}`;
    const content = rankingMessage({
      kind,
      title,
      congrats: congratulations(range.start),
      sections,
      config,
    });
    await send(kind === 'week' ? channels.week : channels.month, content);
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

    const week = weekStart(now);
    await once('last_week_boundary', week, 'classement de la semaine', () =>
      runRanking('week', weekRange(week - 1), now),
    );

    const month = monthStart(now);
    await once('last_month_boundary', month, 'classement du mois', () =>
      runRanking('month', monthRange(month - 1), now),
    );
  }

  return { tick, runDaily, runRanking, checkTeamReleases };
}
