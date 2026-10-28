// Calendrier des lives, en temps universel (GMT).

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// Jours de live (0 = dimanche, 3 = mercredi, 5 = vendredi), heure de l'annonce et heure du live.
export const LIVE_DAYS = [3, 5];
export const ANNOUNCE_HOUR = 12;
export const LIVE_HOUR = 22;

export function dayOf(timestamp) {
  return Math.floor(timestamp / DAY_MS);
}

export function liveTime(day) {
  return day * DAY_MS + LIVE_HOUR * HOUR_MS;
}

export function isLiveDay(day) {
  return LIVE_DAYS.includes(new Date(day * DAY_MS).getUTCDay());
}

// Le live à annoncer maintenant, ou null. Un jour de live, l'annonce part à 12 h ;
// si le bot était éteint, elle part dès son retour, tant que le live n'a pas commencé.
export function dueAnnouncement(now, lastAnnouncedDay) {
  const day = dayOf(now);
  if (!isLiveDay(day) || (lastAnnouncedDay ?? -Infinity) >= day) return null;
  const announceAt = day * DAY_MS + ANNOUNCE_HOUR * HOUR_MS;
  if (now < announceAt || now >= liveTime(day)) return null;
  return { day, liveAt: liveTime(day) };
}

// Prochain live à partir de maintenant (pour l'aperçu).
export function nextLive(now) {
  for (let day = dayOf(now); ; day++) {
    if (isLiveDay(day) && liveTime(day) > now) return liveTime(day);
  }
}
