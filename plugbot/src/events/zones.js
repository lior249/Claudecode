// L'heure d'un live dans les pays francophones d'Afrique et d'Europe, regroupés par heure locale.
// Les changements d'heure (France, Belgique, Suisse, Maroc) sont gérés par les fuseaux horaires.

// Par ordre de priorité : on affiche au plus 5 pays par heure, les premiers de cette liste.
export const COUNTRIES = [
  ['🇸🇳', 'Sénégal', 'Africa/Dakar'],
  ['🇨🇮', "Côte d'Ivoire", 'Africa/Abidjan'],
  ['🇨🇲', 'Cameroun', 'Africa/Douala'],
  ['🇫🇷', 'France', 'Europe/Paris'],
  ['🇲🇱', 'Mali', 'Africa/Bamako'],
  ['🇧🇫', 'Burkina Faso', 'Africa/Ouagadougou'],
  ['🇧🇯', 'Bénin', 'Africa/Porto-Novo'],
  ['🇹🇬', 'Togo', 'Africa/Lome'],
  ['🇨🇬', 'Congo', 'Africa/Brazzaville'],
  ['🇲🇦', 'Maroc', 'Africa/Casablanca'],
  ['🇨🇩', 'RDC (Kinshasa)', 'Africa/Kinshasa'],
  ['🇬🇦', 'Gabon', 'Africa/Libreville'],
  ['🇬🇳', 'Guinée', 'Africa/Conakry'],
  ['🇧🇪', 'Belgique', 'Europe/Brussels'],
  ['🇨🇭', 'Suisse', 'Europe/Zurich'],
  ['🇨🇩', 'RDC (Lubumbashi)', 'Africa/Lubumbashi'],
  ['🇷🇼', 'Rwanda', 'Africa/Kigali'],
  ['🇧🇮', 'Burundi', 'Africa/Bujumbura'],
  ['🇲🇬', 'Madagascar', 'Indian/Antananarivo'],
  ['🇰🇲', 'Comores', 'Indian/Comoro'],
  ['🇩🇯', 'Djibouti', 'Africa/Djibouti'],
  ['🇷🇪', 'La Réunion', 'Indian/Reunion'],
  ['🇲🇺', 'Maurice', 'Indian/Mauritius'],
];

export const MAX_COUNTRIES_PER_TIME = 5;

function weekday(timestamp) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(timestamp);
}

// Décalage (en millisecondes) entre l'heure locale et l'heure universelle à ce moment-là.
export function offsetAt(timestamp, timeZone) {
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
      .formatToParts(timestamp)
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(timestamp / 60000) * 60000;
}

function clock(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getUTCHours())} h ${pad(date.getUTCMinutes())}`;
}

// Une ligne par heure locale, du plus tôt au plus tard. Le jour est précisé quand ce n'est plus
// le même qu'en heure universelle.
export function localTimeLines(timestamp) {
  const groups = new Map();
  for (const [flag, country, timeZone] of COUNTRIES) {
    const offset = offsetAt(timestamp, timeZone);
    if (!groups.has(offset)) groups.set(offset, []);
    const countries = groups.get(offset);
    if (countries.length < MAX_COUNTRIES_PER_TIME) countries.push(`${flag} ${country}`);
  }
  const utcDay = weekday(timestamp);
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([offset, countries]) => {
      const local = timestamp + offset;
      const day = weekday(local);
      const when = day === utcDay ? clock(local) : `${clock(local)} (${day})`;
      return `**${when}** — ${countries.join(' · ')}`;
    });
}
