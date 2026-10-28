// Texte de l'annonce et sondage de présence.

import { HOUR_MS, LIVE_HOUR } from './schedule.js';

// Pays francophones d'Afrique et d'Europe, du Sénégal à Maurice, avec leur fuseau horaire.
// Les changements d'heure (France, Belgique, Suisse, Maroc) sont gérés automatiquement.
export const ZONES = [
  ['🇸🇳', 'Sénégal', 'Africa/Dakar'],
  ['🇲🇱', 'Mali', 'Africa/Bamako'],
  ['🇬🇳', 'Guinée', 'Africa/Conakry'],
  ['🇨🇮', "Côte d'Ivoire", 'Africa/Abidjan'],
  ['🇧🇫', 'Burkina Faso', 'Africa/Ouagadougou'],
  ['🇹🇬', 'Togo', 'Africa/Lome'],
  ['🇲🇦', 'Maroc', 'Africa/Casablanca'],
  ['🇩🇿', 'Algérie', 'Africa/Algiers'],
  ['🇹🇳', 'Tunisie', 'Africa/Tunis'],
  ['🇧🇯', 'Bénin', 'Africa/Porto-Novo'],
  ['🇳🇪', 'Niger', 'Africa/Niamey'],
  ['🇨🇲', 'Cameroun', 'Africa/Douala'],
  ['🇬🇦', 'Gabon', 'Africa/Libreville'],
  ['🇨🇬', 'Congo', 'Africa/Brazzaville'],
  ['🇨🇩', 'RDC (Kinshasa)', 'Africa/Kinshasa'],
  ['🇹🇩', 'Tchad', 'Africa/Ndjamena'],
  ['🇫🇷', 'France', 'Europe/Paris'],
  ['🇧🇪', 'Belgique', 'Europe/Brussels'],
  ['🇨🇭', 'Suisse', 'Europe/Zurich'],
  ['🇨🇩', 'RDC (Lubumbashi)', 'Africa/Lubumbashi'],
  ['🇷🇼', 'Rwanda', 'Africa/Kigali'],
  ['🇧🇮', 'Burundi', 'Africa/Bujumbura'],
  ['🇩🇯', 'Djibouti', 'Africa/Djibouti'],
  ['🇰🇲', 'Comores', 'Indian/Comoro'],
  ['🇲🇬', 'Madagascar', 'Indian/Antananarivo'],
  ['🇷🇪', 'La Réunion', 'Indian/Reunion'],
  ['🇲🇺', 'Maurice', 'Indian/Mauritius'],
];

function weekday(timestamp, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone }).format(timestamp);
}

// Heure locale du live dans un fuseau : « 23 h 00 », et le décalage avec l'heure universelle.
function localTime(liveAt, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(liveAt)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return { label: `${parts.hour} h ${parts.minute}`, offset: asUtc - liveAt };
}

// Pays regroupés par heure locale, du plus tôt au plus tard. Le jour est précisé quand ce n'est
// plus le même qu'en heure universelle (après minuit).
export function localTimeLines(liveAt) {
  const groups = new Map();
  for (const [flag, country, timeZone] of ZONES) {
    const { label, offset } = localTime(liveAt, timeZone);
    if (!groups.has(offset)) groups.set(offset, { label, countries: [] });
    groups.get(offset).countries.push(`${flag} ${country}`);
  }
  const utcDay = weekday(liveAt);
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([offset, { label, countries }]) => {
      const day = weekday(liveAt + offset);
      const when = day === utcDay ? label : `${label} (${day})`;
      return `**${when}** — ${countries.join(' · ')}`;
    });
}

// L'annonce : texte et sondage, qui se ferme au début du live.
export function announcement({ liveAt, now, roleId }) {
  const day = weekday(liveAt);
  const lines = [
    `🔴 **Live ce soir — ${day} à ${String(LIVE_HOUR).padStart(2, '0')} h 00 (GMT)**`,
    "Live réservé aux membres de l'accompagnement. Dis-nous dans le sondage si tu seras là 👇",
    '',
    "🕒 **L'heure du live chez toi :**",
    ...localTimeLines(liveAt),
  ];
  if (roleId) lines.unshift(`<@&${roleId}>`);
  return {
    content: lines.join('\n'),
    poll: {
      question: 'Tu participes au live de ce soir ?',
      answers: [
        { text: 'Oui, je serai là', emoji: '✅' },
        { text: 'Non, je ne pourrai pas', emoji: '❌' },
      ],
      // Discord compte la durée d'un sondage en heures entières.
      durationHours: Math.max(1, Math.ceil((liveAt - now) / HOUR_MS)),
    },
  };
}
