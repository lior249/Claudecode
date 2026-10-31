// Clics et formulaires du parcours. Le membre agit sur son propre parcours ; le coach (Office ou admin)
// clôture les étapes, libère de la prison interne et consulte les listes et les fiches.

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
const COACH_ONLY = new Set(['close', 'closeForm', 'notYet', 'release', 'filter', 'filterValue', 'list', 'listSort', 'listPage', 'fiche', 'ficheUser', 'ficheOf']);
const MEMBER_ONLY = new Set(['profile', 'profileSubmit', 'choices', 'choicesSubmit', 'planning', 'planningSubmit']);

// Les valeurs choisies dans un formulaire, quel que soit le composant : boutons de choix (un seul),
// cases à cocher ou menu déroulant (plusieurs).
function picked(fields, id) {
  const field = fields.fields.get(id);
  if (!field) return [];
  return field.values ?? (field.value == null ? [] : [field.value]);
}

const pickedOne = (fields, id) => picked(fields, id)[0];

// Ouvre un formulaire avec des boutons de choix. Si Discord les refuse, il l'ouvre avec des menus déroulants.
async function showForm(interaction, build) {
  try {
    await interaction.showModal(build({ compat: false }));
  } catch (error) {
    if (error.status !== 400) throw error;
    console.warn('[PlugBot] Boutons de choix refusés par Discord : formulaire avec des menus déroulants.', error.message);
    await interaction.showModal(build({ compat: true }));
  }
}

function positioningAnswers(fields) {
  return {
    niche: fields.getTextInputValue('niche').trim(),
    nicheType: pickedOne(fields, 'nicheType'),
    target: pickedOne(fields, 'target'),
    cta: pickedOne(fields, 'cta'),
  };
}

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
    if (MEMBER_ONLY.has(action) && userId !== interaction.user.id) {
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
        await showForm(interaction, (options) => profileModal(userId, journey.profileOf(userId), options));
        return;
      case 'profileSubmit': {
        const { fields } = interaction;
        await journey.saveProfile(userId, {
          name: fields.getTextInputValue('name').trim(),
          home: pickedOne(fields, 'home'),
          level: pickedOne(fields, 'level'),
          equipment: pickedOne(fields, 'equipment'),
          availability: pickedOne(fields, 'availability'),
        });
        await privately(interaction, profileSavedText());
        return;
      }
      case 'choices': {
        const record = journey.profileOf(userId);
        if (!record || record.stage !== 2) {
          await privately(interaction, "Tes choix se remplissent à l'étape Positionnement.");
          return;
        }
        await showForm(interaction, (options) => positioningModal(userId, record, { byMember: true, ...options }));
        return;
      }
      case 'choicesSubmit': {
        await interaction.deferReply({ flags: PRIVATE });
        const error = await journey.saveChoices(userId, positioningAnswers(interaction.fields), now);
        await interaction.editReply(error ? `⚠️ Rien n'a été enregistré : ${error}` : '✅ Tes choix sont enregistrés. Ton coach les voit dans ton ticket.');
        return;
      }
      case 'planning': {
        const record = journey.profileOf(userId);
        if (!record || record.stage < ENGAGEMENT) {
          await privately(interaction, "Le planning se choisit à l'étape Engagement.");
          return;
        }
        await showForm(interaction, (options) => planningModal(userId, record, options));
        return;
      }
      case 'planningSubmit': {
        const { fields } = interaction;
        await interaction.deferReply({ flags: PRIVATE });
        const error = await journey.savePlanning(
          userId,
          {
            days: picked(fields, 'days').map(Number),
            check1: Number(pickedOne(fields, 'check1')),
            check2: Number(pickedOne(fields, 'check2')),
            home: pickedOne(fields, 'home'),
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
          await showForm(interaction, (options) => positioningModal(userId, journey.profileOf(userId), options));
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
        const details = stage === 2 ? positioningAnswers(fields) : { note: (fields.getTextInputValue('note') ?? '').trim() };
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
        await interaction.update(journey.openList(interaction.user.id, { criterion: extra, value: interaction.values[0] }));
        return;
      case 'list':
        await interaction.reply({ ...journey.openList(interaction.user.id, { list: extra }), flags: PRIVATE });
        return;
      case 'listSort':
      case 'listPage': {
        const change = action === 'listSort' ? { sort: interaction.values[0] } : { move: extra === 'next' ? 1 : -1 };
        const view = journey.changeList(interaction.user.id, change);
        if (view) await interaction.update(view);
        else await privately(interaction, 'Cette liste a expiré (PlugBot a redémarré) : clique à nouveau sur un bouton de #fiches-membres.');
        return;
      }
      case 'fiche':
      case 'ficheUser':
      case 'ficheOf':
        await privately(interaction, '', {
          ...journey.fichePayload(action === 'ficheOf' ? userId : interaction.values[0]),
          allowedMentions: { parse: [] },
        });
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
