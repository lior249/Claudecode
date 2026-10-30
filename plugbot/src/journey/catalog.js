// Le parcours de l'accompagnement : les étapes, les délais et les listes de choix (voir PARCOURS.md).

export const STAGES = [
  { key: 'visionnage', emoji: '🎬', label: 'Visionnage' },
  { key: 'positionnement', emoji: '🧭', label: 'Positionnement' },
  { key: 'confirmation', emoji: '🎥', label: 'Confirmation' },
  { key: 'engagement', emoji: '🚀', label: 'Engagement' },
];
// Numéro de la dernière étape : elle ne se clôture pas.
export const ENGAGEMENT = 4;

export function stageOf(number) {
  return STAGES[number - 1];
}

// Délai pour arriver à l'étape Engagement, depuis l'arrivée dans l'accompagnement (ou la sortie de prison).
export const JOURNEY_DAYS = 5;
// Engagement : au moins 5 jours de post par semaine, et le message du matin à 9 h (heure locale).
export const MIN_POST_DAYS = 5;
export const MORNING_HOUR = 9;
// Le point sur les retardataires, envoyé au coach tous les 3 jours, à 9 h GMT.
export const DIGEST_EVERY_DAYS = 3;
export const DIGEST_HOUR = 9;

// Les listes de choix : [valeur enregistrée, texte affiché].
export const LEVELS = [
  ['debutant', "Je n'ai jamais posté sur TikTok"],
  ['compte', "J'ai déjà un compte, sans résultats"],
  ['resultats', "J'ai déjà des résultats"],
];
export const EQUIPMENT = [
  ['telephone', 'Téléphone seul'],
  ['telephone-micro', 'Téléphone + micro'],
  ['telephone-ordinateur', 'Téléphone + ordinateur'],
  ['complet', 'Téléphone, ordinateur, micro et lumière'],
];
export const AVAILABILITY = [
  ['moins-1h', "Moins d'1 h par jour"],
  ['1-2h', '1 à 2 h par jour'],
  ['2-4h', '2 à 4 h par jour'],
  ['plus-4h', 'Plus de 4 h par jour'],
];
// Les pays de la monétisation : le pays cible, un seul par membre.
export const TARGET_COUNTRIES = [
  ['allemagne', '🇩🇪 Allemagne'],
  ['etats-unis', '🇺🇸 États-Unis'],
  ['france', '🇫🇷 France'],
  ['royaume-uni', '🇬🇧 Royaume-Uni'],
  ['mexique', '🇲🇽 Mexique'],
  ['bresil', '🇧🇷 Brésil'],
  ['japon', '🇯🇵 Japon'],
  ['coree-du-sud', '🇰🇷 Corée du Sud'],
];
export const CTA_METHODS = [
  ['black-hat', '⚫ Black hat'],
  ['gray-hat', '🔘 Gray hat'],
  ['white-hat', '⚪ White hat'],
];
// Les jours de la semaine, du lundi au dimanche (0 = dimanche, comme getUTCDay).
export const WEEKDAYS = [
  [1, 'Lundi'],
  [2, 'Mardi'],
  [3, 'Mercredi'],
  [4, 'Jeudi'],
  [5, 'Vendredi'],
  [6, 'Samedi'],
  [0, 'Dimanche'],
];

// Le texte affiché pour une valeur enregistrée (ou la valeur elle-même si elle n'est pas dans la liste).
export function labelOf(list, value) {
  return list.find(([key]) => String(key) === String(value))?.[1] ?? value;
}
