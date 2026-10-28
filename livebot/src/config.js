// Lit les réglages dans le fichier .env (voir .env.example).

import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
export const STATE_FILE = fileURLToPath(new URL('../data/state.json', import.meta.url));

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

export function loadConfig() {
  loadEnvFile();
  return {
    token: required('DISCORD_TOKEN'),
    channelId: required('CHANNEL_ID'),
    // Rôle mentionné dans l'annonce (facultatif).
    roleId: process.env.ROLE_ID?.trim() || null,
  };
}
