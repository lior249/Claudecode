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
    },
    // Salon des tickets pour sortir de prison : seulement mentionné dans les messages.
    prisonExitChannelId: optional('PRISON_EXIT_CHANNEL_ID', null),
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
