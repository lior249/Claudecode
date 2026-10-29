// Lit les réglages dans le fichier .env (voir .env.example).

import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
const DEFAULT_DATABASE = fileURLToPath(new URL('../data/plugbot.db', import.meta.url));

function loadEnvFile() {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Réglage manquant dans .env : ${name}`);
  return value;
}

function optional(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

export function loadConfig() {
  loadEnvFile();

  const streakRoleDays = Number(optional('STREAK_ROLE_DAYS', '21'));
  if (!Number.isInteger(streakRoleDays) || streakRoleDays < 1) {
    throw new Error('STREAK_ROLE_DAYS doit être un nombre entier supérieur ou égal à 1.');
  }

  return {
    token: required('DISCORD_TOKEN'),
    guildId: required('GUILD_ID'),
    channels: {
      results: required('RESULTS_CHANNEL_ID'),
      showup: required('SHOWUP_CHANNEL_ID'),
      week: required('WEEK_CHANNEL_ID'),
      month: required('MONTH_CHANNEL_ID'),
      prison: required('PRISON_CHANNEL_ID'),
      // Facultatif : sans lui, le top all-time n'est pas publié.
      allTime: optional('ALLTIME_CHANNEL_ID', null),
      // Facultatifs : sans eux, la planification des événements est désactivée.
      planning: optional('PLANNING_CHANNEL_ID', null),
      // Facultatif : sans lui, les rappels pour planifier arrivent dans le salon de création.
      planningReminder: optional('PLANNING_REMINDER_CHANNEL_ID', null),
      announceFree: optional('ANNOUNCE_FREE_CHANNEL_ID', null),
      announcePlug: optional('ANNOUNCE_PLUG_CHANNEL_ID', null),
    },
    // Salons seulement mentionnés dans les messages : PlugBot n'a pas besoin d'y avoir accès.
    links: {
      bonusWeek: required('BONUS_WEEK_CHANNEL_ID'),
      bonusMonth: required('BONUS_MONTH_CHANNEL_ID'),
      bonusStreak: required('BONUS_STREAK_CHANNEL_ID'),
      guide: required('GUIDE_CHANNEL_ID'),
    },
    roles: {
      free: required('FREE_ROLE_ID'),
      plug: required('PLUG_ROLE_ID'),
      streak: required('STREAK_ROLE_ID'),
      weekWinner: required('WEEK_WINNER_ROLE_ID'),
      monthWinner: required('MONTH_WINNER_ROLE_ID'),
      prisoner: required('PRISONER_ROLE_ID'),
    },
    streakRoleDays,
    adminIds: new Set(
      required('ADMIN_USER_IDS')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
    databasePath: optional('DATABASE_PATH', DEFAULT_DATABASE),
  };
}
