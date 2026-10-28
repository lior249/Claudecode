// Un seul LiveBot à la fois, sinon chaque annonce partirait deux fois.
// Le port réservé sert de verrou : le système le libère tout seul quand le bot s'arrête.

import { createServer } from 'node:net';

export const LOCK_PORT = 47613;

export function acquireLock(port = LOCK_PORT) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.unref();
      resolve(true);
    });
  });
}
