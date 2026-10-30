// Clics et formulaires du parcours. Le membre agit sur son propre parcours ; le coach (Office ou admin)
// clôture les étapes, libère de la prison interne et filtre les fiches.

import { MessageFlags } from 'discord.js';
import { ENGAGEMENT } from './catalog.js';
import { profileSavedText } from './render.js';
import {
  confirmationModal,
  filterValueComponents,
  parseCustomId,
  planningModal,
  positioningModal,
  profileModal,
} from './ui.js';

const PRIVATE = MessageFlags.Ephemeral;
const COACH_ONLY = new Set(['close', 'closeForm', 'notYet', 'release', 'filter', 'filterValue']);

export function createJourneyInteractions({ guild }, journey) {
  async function privately(interaction, content, extra = {}) {
    const payload = { content, flags: PRIVATE, ...extra };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  }

  // Répond sous la question du ticket, et retire ses boutons. À appeler après deferUpdate.
  async function answerBelow(interaction, text) {
    await interaction.editReply({ content: `${interaction.message.content}\n\n${text}`, components: [] });
  }

  async function handle(interaction) {
    const parsed = parseCustomId(interaction.customId ?? '');
    if (!parsed) return;
    const { action, userId, extra } = parsed;
    const member = interaction.member ?? guild.members.cache.get(interaction.user.id);
    const now = Date.now();

    if (COACH_ONLY.has(action) && !journey.isCoach(member)) {
      await privately(interaction, 'Réservé aux coachs.');
      return;
    }
    // Les boutons d'un ticket ne servent qu'au membre du ticket.
    if (['profile', 'profileSubmit', 'planning', 'planningSubmit'].includes(action) && userId !== interaction.user.id) {
      await privately(interaction, 'Ce bouton est pour le membre de ce ticket.');
      return;
    }

    switch (action) {
      case 'open':
      case 'exit': {
        await interaction.deferReply({ flags: PRIVATE });
        const reply = action === 'open' ? await journey.openStage(member, Number(extra), now) : await journey.openExitTicket(member, now);
        await interaction.editReply(reply);
        return;
      }
      case 'profile':
        await interaction.showModal(profileModal(userId, journey.profileOf(userId)));
        return;
      case 'profileSubmit': {
        const { fields } = interaction;
        journey.saveProfile(userId, {
          name: fields.getTextInputValue('name').trim(),
          home: fields.getStringSelectValues('home')[0],
          level: fields.getStringSelectValues('level')[0],
          equipment: fields.getStringSelectValues('equipment')[0],
          availability: fields.getStringSelectValues('availability')[0],
        });
        await privately(interaction, profileSavedText());
        return;
      }
      case 'planning': {
        const record = journey.profileOf(userId);
        if (!record || record.stage < ENGAGEMENT) {
          await privately(interaction, "Le planning se choisit à l'étape Engagement.");
          return;
        }
        await interaction.showModal(planningModal(userId, record));
        return;
      }
      case 'planningSubmit': {
        const { fields } = interaction;
        await interaction.deferReply({ flags: PRIVATE });
        const hasHome = fields.fields?.has?.('home') ?? false;
        const error = await journey.savePlanning(
          userId,
          {
            days: fields.getStringSelectValues('days').map(Number),
            check1: Number(fields.getStringSelectValues('check1')[0]),
            check2: Number(fields.getStringSelectValues('check2')[0]),
            home: hasHome ? fields.getStringSelectValues('home')[0] : undefined,
          },
          now,
        );
        await interaction.editReply(error ? `⚠️ Rien n'a été enregistré : ${error}` : '✅ Planning enregistré.');
        return;
      }
      case 'close': {
        const stage = Number(extra);
        if (!journey.closeQuestionNeeded(userId, stage)) {
          await interaction.update({ content: `${interaction.message.content}\n\nℹ️ Cette étape est déjà clôturée.`, components: [] });
          return;
        }
        if (stage === 2) {
          await interaction.showModal(positioningModal(userId, journey.profileOf(userId)));
          return;
        }
        if (stage === 3) {
          await interaction.showModal(confirmationModal(userId));
          return;
        }
        await interaction.deferUpdate();
        await journey.closeStage(userId, stage, {}, now);
        await answerBelow(interaction, `✅ Étape clôturée par <@${interaction.user.id}>.`);
        return;
      }
      case 'closeForm': {
        const stage = Number(extra);
        const { fields } = interaction;
        const details =
          stage === 2
            ? {
                niche: fields.getTextInputValue('niche').trim(),
                nicheType: fields.getTextInputValue('nicheType').trim(),
                target: fields.getStringSelectValues('target')[0],
                cta: fields.getStringSelectValues('cta')[0],
              }
            : { note: (fields.getTextInputValue('note') ?? '').trim() };
        await interaction.deferUpdate();
        const closed = await journey.closeStage(userId, stage, details, now);
        await answerBelow(interaction, closed ? `✅ Étape clôturée par <@${interaction.user.id}>.` : 'ℹ️ Cette étape est déjà clôturée.');
        return;
      }
      case 'notYet':
        await interaction.update({ content: `${interaction.message.content}\n\n⏸️ Pas encore : l'étape continue.`, components: [] });
        return;
      case 'release': {
        await interaction.deferReply({ flags: PRIVATE });
        const error = await journey.release(userId, now);
        await interaction.editReply(error ?? '🔓 Membre libéré.');
        return;
      }
      case 'filter': {
        const criterion = interaction.values[0];
        const options = journey.filterOptions(criterion);
        if (options.length === 0) {
          await privately(interaction, 'Aucun membre ne renseigne encore ce critère.');
          return;
        }
        await privately(interaction, 'Choisis une valeur :', { components: filterValueComponents(criterion, options) });
        return;
      }
      case 'filterValue':
        await interaction.update({ content: journey.filterResult(extra, interaction.values[0]) });
        return;
      default:
        await privately(interaction, 'Action inconnue.');
    }
  }

  return async function onInteraction(interaction) {
    try {
      await handle(interaction);
    } catch (error) {
      console.error('[PlugBot] Erreur dans le parcours :', error);
      await privately(interaction, `⚠️ Erreur : ${error.message}`).catch(() => {});
    }
  };
}
