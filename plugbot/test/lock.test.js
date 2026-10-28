import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { acquireLock } from '../src/lock.js';

const lockPath = () => join(mkdtempSync(join(tmpdir(), 'plugbot-lock-')), 'plugbot.pid');

describe('acquireLock', () => {
  it('prend la place quand aucun PlugBot ne tourne', () => {
    const path = lockPath();
    assert.equal(acquireLock(path), null);
    assert.equal(Number(readFileSync(path, 'utf8')), process.pid);
  });

  it("ignore un ancien numéro qui n'est plus un PlugBot", () => {
    const path = lockPath();
    writeFileSync(path, '999999999');
    assert.equal(acquireLock(path), null);
  });

  it('refuse de démarrer si un autre PlugBot tourne', async (t) => {
    const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', 'src/index.js']);
    t.after(() => other.kill());
    await new Promise((resolve) => other.once('spawn', resolve));
    const path = lockPath();
    writeFileSync(path, String(other.pid));
    assert.equal(acquireLock(path), other.pid);
  });
});
