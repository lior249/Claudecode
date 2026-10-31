// Les commandes slash : /moi et /classement pour tout le monde, et les commandes des coachs
// (événements, listes et fiches des membres, validation d'étape, libération de prison).
// Les réponses ne sont visibles que par celui qui tape la commande.

import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { LIVE_TYPES } from './events/catalog.js';
import { planningDoneMessage } from './events/render.js';
import { LISTS } from './journey/ui.js';
import { RANKING_SIZES, leaderboardMessage, statsMessage } from './messages.js';
import { leaderboard } from './stats.js';
import { ALL_TIME, dayOf, monthName, monthRange, weekRange } from './time.js';

const PRIVATE = MessageFlags.Ephemeral;
const QUIET = { parse: [] };

const PERIODS = {
  semaine: { title: () => 'semaine en cours', range: (now) => weekRange(now), size: RANKING_SIZES.week },
  mois: { title: (now) => monthName(monthRange(now).end), range: (now) => monthRange(now), size: RANKING_SIZES.month },
  total: { title: () => 'depuis le lancement', range: () => ALL_TIME, size: RANKING_SIZES.allTime },
};

// Les commandes des coachs ne sont visibles que par les admins du serveur. Pour les ouvrir au rôle
// Office : Paramètres du serveur > Intégrations > PlugBot.
function coachCommand(name, description) {
  return new SlashCommandBuilder().setName(name).setDescription(description).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
}

const memberOption = (description) => (option) => option.setName('membre').setDescription(description).setRequired(true);

// Les commandes, selon les fonctions actives (planification des événements, parcours de l'accompagnement).
export function commandDefinitions({ events, journey }) {
  const commands = [
    new SlashCommandBuilder().setName('moi').setDescription('Tes points, ta chaîne, ton rang et ta situation'),
    new SlashCommandBuilder()
      .setName('classement')
      .setDescription('Le classement de la semaine, du mois ou depuis le lancement')
      .addStringOption((option) =>
        option
          .setName('periode')
          .setDescription('Quelle période ?')
          .addChoices({ name: 'Semaine (top 7)', value: 'semaine' }, { name: 'Mois (top 30)', value: 'mois' }, { name: 'Depuis le lancement', value: 'total' }),
      ),
    coachCommand('liberer', "Libérer un membre de prison (commune ou interne)").addUserOption(memberOption('Le membre à libérer')),
  ];
  if (events) {
    commands.push(
      coachCommand('evenement', 'Créer et suivre les événements')
        .addSubcommand((sub) =>
          sub
            .setName('creer')
            .setDescription('Ouvrir le ticket d’un nouvel événement')
            .addStringOption((option) =>
              option
                .setName('type')
                .setDescription('Le type de live')
                .setRequired(true)
                .addChoices(...LIVE_TYPES.map((type) => ({ name: `${type.emoji} ${type.label}`, value: type.key }))),
            ),
        )
        .addSubcommand((sub) => sub.setName('liste').setDescription('Les événements à venir'))
        .addSubcommand((sub) => sub.setName('fini').setDescription("J'ai fini de créer mes événements : plus de rappel cette semaine")),
    );
  }
  if (journey) {
    commands.push(
      coachCommand('membres', "Une liste des membres de l'accompagnement").addStringOption((option) =>
        option
          .setName('liste')
          .setDescription('Quelle liste ?')
          .setRequired(true)
          .addChoices(...Object.entries(LISTS).map(([value, { label, emoji }]) => ({ name: `${emoji} ${label}`, value }))),
      ),
      coachCommand('fiche', "La fiche d'un membre de l'accompagnement").addUserOption(memberOption('Le membre')),
      coachCommand('valider', "Clôturer l'étape en cours d'un membre du parcours").addUserOption(memberOption('Le membre')),
    );
  }
  return commands;
}

export function createCommands(ctx) {
  const { config, db, tracker, guild, prison } = ctx;

  function isCoach(member) {
    return ctx.journey ? ctx.journey.isCoach(member) : config.adminIds.has(member?.id);
  }

  // Le rang du membre dans sa catégorie, pour la période `range`.
  function standing(member, now, range) {
    const rows = [...tracker.snapshot(guild.members.cache, now, range).values()];
    const row = rows.find((candidate) => candidate.userId === member.id);
    if (!row) return null;
    const rank = leaderboard(rows, row.category).findIndex((entry) => entry.userId === member.id) + 1;
    return { row, points: row.points, rank };
  }

  async function me(interaction, member, now) {
    const week = standing(member, now, weekRange(now));
    if (!week) {
      await interaction.reply({ content: "Tu n'es pas suivi par PlugBot : il faut le rôle Free ou TikTok.", flags: PRIVATE });
      return;
    }
    const content = statsMessage({
      chain: week.row.chain,
      category: week.row.category,
      prison: week.row.prison,
      week,
      month: standing(member, now, monthRange(now)),
      total: standing(member, now, ALL_TIME),
      journeyLine: ctx.journey?.journeyLine(member.id),
    });
    await interaction.reply({ content, flags: PRIVATE, allowedMentions: QUIET });
  }

  async function ranking(interaction, member, now) {
    const period = PERIODS[interaction.options.getString('periode') ?? 'semaine'];
    const range = period.range(now);
    const mine = standing(member, now, range);
    const content = leaderboardMessage({
      title: period.title(now),
      sections: tracker.rankings(guild.members.cache, now, range, period.size),
      me: mine && !mine.row.prison.inPrison ? { rank: mine.rank, points: mine.points } : null,
    });
    await interaction.reply({ content, flags: PRIVATE, allowedMentions: QUIET });
  }

  async function release(interaction, now) {
    const user = interaction.options.getUser('membre');
    const record = db.getPrison(user.id);
    if (!record) {
      await interaction.reply({ content: `<@${user.id}> n'est pas en prison.`, flags: PRIVATE, allowedMentions: QUIET });
      return;
    }
    await interaction.deferReply({ flags: PRIVATE });
    let error = null;
    if (record.internal && ctx.journey) {
      error = await ctx.journey.release(user.id, now);
    } else {
      const target = guild.members.cache.get(user.id) ?? (await guild.members.fetch(user.id).catch(() => null));
      if (target) await prison.releaseByTeam(target, dayOf(now));
      else error = "Ce membre n'est plus sur le serveur.";
    }
    await interaction.editReply({ content: error ?? `🔓 <@${user.id}> est libéré.`, allowedMentions: QUIET });
  }

  async function event(interaction, now) {
    const service = ctx.eventService;
    switch (interaction.options.getSubcommand()) {
      case 'creer': {
        await interaction.deferReply({ flags: PRIVATE });
        const thread = await service.openTicket(interaction.options.getString('type'), now);
        await interaction.editReply(`🎫 Ticket ouvert : <#${thread.id}>`);
        return;
      }
      case 'liste':
        await interaction.reply({ content: service.upcomingList(), flags: PRIVATE });
        return;
      default:
        service.markPlanningDone(now);
        await interaction.reply({ content: planningDoneMessage(), flags: PRIVATE });
    }
  }

  async function validate(interaction) {
    const user = interaction.options.getUser('membre');
    const question = ctx.journey.closeQuestionFor(user.id);
    if (!question) {
      await interaction.reply({ content: `<@${user.id}> n'a pas d'étape à clôturer.`, flags: PRIVATE, allowedMentions: QUIET });
      return;
    }
    await interaction.reply({ ...question, flags: PRIVATE, allowedMentions: QUIET });
  }

  const COACH_COMMANDS = new Set(['liberer', 'evenement', 'membres', 'fiche', 'valider']);

  async function handle(interaction) {
    const member = interaction.member ?? guild.members.cache.get(interaction.user.id);
    const now = Date.now();
    if (COACH_COMMANDS.has(interaction.commandName) && !isCoach(member)) {
      await interaction.reply({ content: 'Réservé aux coachs.', flags: PRIVATE });
      return;
    }
    switch (interaction.commandName) {
      case 'moi':
        return me(interaction, member, now);
      case 'classement':
        return ranking(interaction, member, now);
      case 'liberer':
        return release(interaction, now);
      case 'evenement':
        return event(interaction, now);
      case 'membres':
        return interaction.reply({
          ...ctx.journey.openList(interaction.user.id, { list: interaction.options.getString('liste') }),
          flags: PRIVATE,
        });
      case 'fiche':
        return interaction.reply({
          ...ctx.journey.fichePayload(interaction.options.getUser('membre').id),
          flags: PRIVATE,
          allowedMentions: QUIET,
        });
      case 'valider':
        return validate(interaction);
      default:
        return interaction.reply({ content: 'Commande inconnue.', flags: PRIVATE });
    }
  }

  // Enregistre les commandes sur le serveur (elles apparaissent tout de suite). Ne lève jamais d'erreur.
  async function register() {
    const definitions = commandDefinitions({ events: Boolean(ctx.eventService), journey: Boolean(ctx.journey) });
    try {
      await guild.commands.set(definitions.map((command) => command.toJSON()));
      console.log(`[PlugBot] Commandes slash prêtes : ${definitions.map((command) => `/${command.name}`).join(', ')}.`);
    } catch (error) {
      const appId = guild.client?.application?.id ?? 'APPLICATION_ID';
      console.error(
        `[PlugBot] Les commandes slash n'ont pas pu être enregistrées (${error.message}). ` +
          `Ouvre ce lien et choisis ton serveur pour autoriser les commandes : ` +
          `https://discord.com/oauth2/authorize?client_id=${appId}&scope=bot+applications.commands`,
      );
    }
  }

  return {
    register,
    async onCommand(interaction) {
      try {
        await handle(interaction);
      } catch (error) {
        console.error(`[PlugBot] Erreur dans la commande /${interaction.commandName} :`, error);
        const payload = { content: `⚠️ Erreur : ${error.message}`, flags: PRIVATE };
        await (interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload)).catch(() => {});
      }
    },
  };
}
