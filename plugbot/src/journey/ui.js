// Boutons, menus et formulaires du parcours de l'accompagnement.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { AVAILABILITY, CTA_METHODS, EQUIPMENT, LEVELS, MIN_POST_DAYS, STAGES, TARGET_COUNTRIES, WEEKDAYS } from './catalog.js';
import { HOME_COUNTRIES, hourLabel } from './clock.js';
import { exitPanelText, filterPanelText, panelText } from './render.js';

// Identifiants des boutons et menus : « pc:<action>:<membre concerné>:<précision> ».
export function customId(action, userId = '', extra = '') {
  return `pc:${action}:${userId}:${extra}`;
}

export function parseCustomId(id) {
  const [prefix, action, userId, extra] = id.split(':');
  return prefix === 'pc' ? { action, userId: userId || null, extra: extra || null } : null;
}

const row = (...components) => new ActionRowBuilder().addComponents(...components);

function button(id, label, emoji, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
}

function select(id, options, { selected = [], min = 1, max = 1, placeholder } = {}) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id)
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(options.map(([value, label]) => ({ label: String(label), value: String(value), default: selected.map(String).includes(String(value)) })));
  if (placeholder) menu.setPlaceholder(placeholder);
  return menu;
}

function labelled(label, component, description) {
  const wrapper = new LabelBuilder().setLabel(label);
  if (description) wrapper.setDescription(description);
  return component instanceof TextInputBuilder ? wrapper.setTextInputComponent(component) : wrapper.setStringSelectMenuComponent(component);
}

function textInput(id, { value, required = true, style = TextInputStyle.Short, maxLength = 100 } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required).setMaxLength(maxLength);
  if (value) input.setValue(value);
  return input;
}

// Le panneau de #parcours : un bouton par étape.
export function parcoursPanel() {
  return {
    content: panelText(),
    components: [row(...STAGES.map((stage, index) => button(customId('open', '', index + 1), stage.label, stage.emoji, ButtonStyle.Primary)))],
  };
}

export function profileComponents(userId) {
  return [row(button(customId('profile', userId), 'Remplir ma fiche', '📝', ButtonStyle.Primary))];
}

export function planningComponents(userId) {
  return [row(button(customId('planning', userId), 'Choisir mes jours et mes heures', '🗓️', ButtonStyle.Primary))];
}

const HOME_OPTIONS = HOME_COUNTRIES.map(([flag, name]) => [name, `${flag} ${name}`]);

export function profileModal(userId, record) {
  return new ModalBuilder()
    .setCustomId(customId('profileSubmit', userId))
    .setTitle('Ma fiche')
    .addLabelComponents(
      labelled('Ton nom complet', textInput('name', { value: record.fullName, maxLength: 80 })),
      labelled('Le pays où tu vis', select('home', HOME_OPTIONS, { selected: [record.homeCountry] }), 'Tes rappels seront dans ton heure locale.'),
      labelled('Ton niveau', select('level', LEVELS, { selected: [record.level] })),
      labelled('Ton matériel', select('equipment', EQUIPMENT, { selected: [record.equipment] })),
      labelled('Ta disponibilité', select('availability', AVAILABILITY, { selected: [record.availability] })),
    );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => [hour, hourLabel(hour)]);

// Le planning de l'Engagement. Le pays n'est demandé que s'il manque dans la fiche.
export function planningModal(userId, record) {
  const modal = new ModalBuilder()
    .setCustomId(customId('planningSubmit', userId))
    .setTitle('Mon planning de posts')
    .addLabelComponents(
      labelled('Tes jours de post', select('days', WEEKDAYS, { selected: record.postDays, min: MIN_POST_DAYS, max: 7 }), `Au moins ${MIN_POST_DAYS} jours.`),
      labelled('1ʳᵉ vérification (heure locale)', select('check1', HOURS, { selected: record.check1 == null ? [] : [record.check1] })),
      labelled('2ᵉ vérification (heure locale)', select('check2', HOURS, { selected: record.check2 == null ? [] : [record.check2] }), 'Plus tard que la 1ʳᵉ.'),
    );
  if (!record.homeCountry) modal.addLabelComponents(labelled('Le pays où tu vis', select('home', HOME_OPTIONS)));
  return modal;
}

export function closeQuestionComponents(userId, stage) {
  return [
    row(
      button(customId('close', userId, stage), "Clôturer l'étape", '✅', ButtonStyle.Success),
      button(customId('notYet', userId, stage), 'Pas encore', '⏸️'),
    ),
  ];
}

// Ce que tu notes en clôturant le Positionnement.
export function positioningModal(userId, record) {
  return new ModalBuilder()
    .setCustomId(customId('closeForm', userId, 2))
    .setTitle('Clôturer le Positionnement')
    .addLabelComponents(
      labelled('Niche', textInput('niche', { value: record.niche })),
      labelled('Type de niche', textInput('nicheType', { value: record.nicheType })),
      labelled('Pays cible', select('target', TARGET_COUNTRIES, { selected: [record.targetCountry] })),
      labelled('Méthode CTA', select('cta', CTA_METHODS, { selected: [record.ctaMethod] })),
    );
}

export function confirmationModal(userId) {
  return new ModalBuilder()
    .setCustomId(customId('closeForm', userId, 3))
    .setTitle('Clôturer la Confirmation')
    .addLabelComponents(
      labelled(
        'Ta note (facultatif)',
        textInput('note', { required: false, style: TextInputStyle.Paragraph, maxLength: 500 }),
        'Un commentaire sur sa qualité, gardé dans sa fiche.',
      ),
    );
}

export function exitPanel() {
  return { content: exitPanelText(), components: [row(button(customId('exit'), 'Ouvrir mon ticket de sortie', '📝', ButtonStyle.Primary))] };
}

export function releaseComponents(userId) {
  return [row(button(customId('release', userId), 'Libérer', '🔓', ButtonStyle.Success))];
}

// Les critères du filtre de #fiches-membres.
export const FILTERS = {
  stage: 'Étape',
  status: 'Statut',
  target: 'Pays cible',
  cta: 'Méthode CTA',
  nicheType: 'Type de niche',
  niche: 'Niche',
  home: 'Pays où il vit',
  level: 'Niveau',
  equipment: 'Matériel',
  availability: 'Disponibilité',
};

export function filterPanel() {
  return {
    content: filterPanelText(),
    components: [row(select(customId('filter'), Object.entries(FILTERS), { placeholder: 'Filtrer par…' }))],
  };
}

// Les valeurs possibles d'un critère : [valeur, texte] (25 au maximum).
export function filterValueComponents(criterion, options) {
  return [row(select(customId('filterValue', '', criterion), options.slice(0, 25), { placeholder: `${FILTERS[criterion]} :` }))];
}
