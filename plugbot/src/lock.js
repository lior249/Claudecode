// Empêche deux PlugBot de tourner en même temps sur la même base : chaque message partirait deux fois.

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Vrai si le processus `pid` existe et fait tourner PlugBot (sous Linux, d'après /proc).
// Après un redémarrage du VPS, un ancien numéro peut appartenir à un tout autre programme.
function isPlugBot(pid) {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('src/index.js');
  } catch {
    return false;
  }
}

function readPid(path) {
  try {
    return Number(readFileSync(path, 'utf8')) || null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Renvoie le numéro de l'autre PlugBot s'il tourne déjà, sinon prend la place et renvoie null.
export function acquireLock(path) {
  const pid = readPid(path);
  if (pid && pid !== process.pid && isPlugBot(pid)) return pid;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, String(process.pid));
  process.on('exit', () => {
    if (readPid(path) === process.pid) unlinkSync(path);
  });
  return null;
}
