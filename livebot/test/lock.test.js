import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { acquireLock } from '../src/lock.js';

describe('verrou', () => {
  it('refuse un deuxième LiveBot', async () => {
    const port = 47614;
    assert.equal(await acquireLock(port), true);
    assert.equal(await acquireLock(port), false);
  });
});
