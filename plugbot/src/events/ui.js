// Boutons, menus et formulaires Discord du panneau de planification et des tickets.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { AUDIENCES, LIVE_TYPES, MENTIONS, REMINDERS, audiencesOf, liveType } from './catalog.js';
import { DONE_LABEL, ticketSummary } from './render.js';

// Identifiants des boutons et menus : « ev:<action>:<numéro de l'événement> ».
export function customId(action, eventId = '') {
  return `ev:${action}:${eventId}`;
}

export function parseCustomId(id) {
  const [prefix, action, eventId] = id.split(':');
  return prefix === 'ev' ? { action, eventId: eventId ? Number(eventId) : null } : null;
}

function rows(components, perRow) {
  const result = [];
  for (let i = 0; i < components.length; i += perRow) {
    result.push(new ActionRowBuilder().addComponents(components.slice(i, i + perRow)));
  }
  return result;
}

const doneButton = (action) =>
  new ButtonBuilder().setCustomId(customId(action)).setLabel(DONE_LABEL).setEmoji('✅').setStyle(ButtonStyle.Success);

// Le panneau, épinglé en haut du salon de création : un bouton par type de live, utilisable à tout moment.
// reminderChannelId : le salon où arrivent les rappels pour planifier.
export function panelMessage({ reminderChannelId } = {}) {
  const typeButtons = LIVE_TYPES.map((type) =>
    new ButtonBuilder().setCustomId(customId(`open-${type.key}`)).setLabel(type.label).setEmoji(type.emoji).setStyle(ButtonStyle.Secondary),
  );
  const many = new StringSelectMenuBuilder()
    .setCustomId(customId('openMany'))
    .setPlaceholder("Ouvrir plusieurs tickets d'un coup…")
    .setMinValues(1)
    .setMaxValues(LIVE_TYPES.length)
    .addOptions(LIVE_TYPES.map((type) => ({ label: type.label, value: type.key, emoji: type.emoji })));
  return {
    content: [
      '🎛️ **Créer un événement — panneau PlugBot**',
      'Clique sur un type de live pour ouvrir un ticket, quand tu veux. Chaque ticket = un live.',
      "Pour en créer plusieurs d'un coup, choisis-les dans le menu.",
      ...(reminderChannelId ? [`Les rappels pour planifier tes événements arrivent dans <#${reminderChannelId}>.`] : []),
    ].join('\n'),
    components: [
      ...rows(typeButtons, 5),
      new ActionRowBuilder().addComponents(many),
      new ActionRowBuilder().addComponents(
        doneButton('planningDone'),
        new ButtonBuilder().setCustomId(customId('list')).setLabel('Événements à venir').setEmoji('📋').setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function planningPromptComponents() {
  return [new ActionRowBuilder().addComponents(doneButton('planningDone'))];
}

// Sous la question « Est-ce que tu as fini de créer tes événements ? ».
export function finishedQuestionComponents() {
  return [
    new ActionRowBuilder().addComponents(
      doneButton('finished'),
      new ButtonBuilder().setCustomId(customId('another')).setLabel('Je crée un autre événement').setEmoji('➕').setStyle(ButtonStyle.Primary),
    ),
  ];
}

const EDITABLE = new Set(['draft', 'scheduled']);

// Les réglages du ticket : public, lieu, modèle de texte, rôles, rappels.
export function settingsMessage(event) {
  if (!EDITABLE.has(event.status)) return { content: '⚙️ **Réglages**', components: [] };
  const type = liveType(event.type);
  const components = [];

  const audiences = audiencesOf(type);
  if (audiences.length > 1) {
    components.push(
      new StringSelectMenuBuilder()
        .setCustomId(customId('audience', event.id))
        .setPlaceholder('Public : Free ou Accompagnement ?')
        .addOptions(audiences.map((key) => ({ label: AUDIENCES[key], value: key, default: event.audience === key }))),
    );
  }

  const location = new ChannelSelectMenuBuilder()
    .setCustomId(customId('location', event.id))
    .setPlaceholder('Lieu : un salon vocal ou « stage » (ou le bouton Lien externe)')
    .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice);
  if (event.locationChannel) location.setDefaultChannels(event.locationChannel);
  components.push(location);

  const texts = event.audience ? type.texts[event.audience] : null;
  const template = new StringSelectMenuBuilder().setCustomId(customId('template', event.id));
  if (texts) {
    template.setPlaceholder('Texte de présentation').addOptions(
      ...texts.map((text, index) => ({
        label: `Modèle ${index + 1}`,
        description: text.slice(0, 100),
        value: String(index),
        default: event.template === index,
      })),
      { label: 'Aucun modèle, seulement mon texte', value: '-1', default: event.template === -1 },
    );
  } else {
    template.setPlaceholder("Texte de présentation : choisis d'abord le public").setDisabled(true).addOptions({ label: '—', value: 'none' });
  }
  components.push(template);

  components.push(
    new StringSelectMenuBuilder()
      .setCustomId(customId('roles', event.id))
      .setPlaceholder('Rôles à mentionner')
      .setMinValues(0)
      .setMaxValues(Object.keys(MENTIONS).length)
      .addOptions(Object.entries(MENTIONS).map(([key, label]) => ({ label, value: key, default: event.roles.includes(key) }))),
  );

  components.push(
    new StringSelectMenuBuilder()
      .setCustomId(customId('reminders', event.id))
      .setPlaceholder('Rappels')
      .setMinValues(0)
      .setMaxValues(Object.keys(REMINDERS).length)
      .addOptions(
        Object.entries(REMINDERS).map(([key, { label }]) => ({ label, value: key, default: event.reminders.includes(key) })),
      ),
  );

  return { content: '⚙️ **Réglages**', components: components.map((component) => new ActionRowBuilder().addComponents(component)) };
}

// Le résumé et les boutons d'action du ticket.
export function controlMessage(event, context) {
  const content = ticketSummary(event, context);
  if (!EDITABLE.has(event.status)) return { content, components: [] };
  const button = (action, label, emoji, style) =>
    new ButtonBuilder().setCustomId(customId(action, event.id)).setLabel(label).setEmoji(emoji).setStyle(style);
  const common = [
    button('info', 'Sujet, date, heure', '📝', ButtonStyle.Primary),
    button('link', 'Lien externe', '🔗', ButtonStyle.Secondary),
    button('preview', 'Aperçu', '👁️', ButtonStyle.Secondary),
  ];
  const specific =
    event.status === 'draft'
      ? [button('validate', 'Valider', '✅', ButtonStyle.Success), button('delete', 'Supprimer', '🗑️', ButtonStyle.Danger)]
      : [button('save', 'Enregistrer les changements', '💾', ButtonStyle.Success), button('cancel', "Annuler l'événement", '❌', ButtonStyle.Danger)];
  return { content, components: [new ActionRowBuilder().addComponents(...common, ...specific)] };
}

export function cancelConfirmation(event) {
  return {
    content: "Annuler cet événement ? Les membres seront prévenus si l'annonce était déjà partie.",
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customId('cancelConfirm', event.id)).setLabel('Oui, annuler').setEmoji('❌').setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

function input(id, label, style, { value, placeholder, required = true, maxLength } = {}) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required);
  if (value) field.setValue(value);
  if (placeholder) field.setPlaceholder(placeholder);
  if (maxLength) field.setMaxLength(maxLength);
  return new ActionRowBuilder().addComponents(field);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

// Formulaire : sujet, date, heure, durée, texte libre.
export function infoModal(event) {
  const start = event.startAt ? new Date(event.startAt) : null;
  return new ModalBuilder()
    .setCustomId(customId('infoSubmit', event.id))
    .setTitle('Sujet, date et heure du live')
    .addComponents(
      input('title', 'Sujet du live', TextInputStyle.Short, { value: event.title, maxLength: 90 }),
      input('date', 'Date (JJ/MM)', TextInputStyle.Short, {
        value: start ? `${pad(start.getUTCDate())}/${pad(start.getUTCMonth() + 1)}` : undefined,
        placeholder: '05/11',
      }),
      input('time', 'Heure de début, en GMT (HH:MM)', TextInputStyle.Short, {
        value: start ? `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}` : undefined,
        placeholder: '22:00',
      }),
      input('duration', 'Durée en minutes', TextInputStyle.Short, { value: String(event.durationMin) }),
      input('details', 'Ton texte pour donner envie (facultatif)', TextInputStyle.Paragraph, {
        value: event.details || undefined,
        required: false,
        maxLength: 1500,
      }),
    );
}

export function linkModal(event) {
  return new ModalBuilder()
    .setCustomId(customId('linkSubmit', event.id))
    .setTitle('Lien externe du live')
    .addComponents(
      input('url', 'Lien (YouTube, Zoom, Google Meet…)', TextInputStyle.Short, {
        value: event.locationUrl ?? undefined,
        placeholder: 'https://…',
        maxLength: 100,
      }),
    );
}
