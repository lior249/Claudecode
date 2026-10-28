// Mémorise le dernier jour annoncé, pour ne jamais annoncer deux fois le même live.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readLastAnnouncedDay(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8')).lastAnnouncedDay ?? null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function writeLastAnnouncedDay(path, day) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ lastAnnouncedDay: day }));
}
