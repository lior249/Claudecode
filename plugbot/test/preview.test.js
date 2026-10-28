import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitMessage } from '../src/messages.js';
import { previewMessages } from '../src/preview.js';

const config = {
  channels: { results: 'res' },
  links: { bonusWeek: 'b7', bonusMonth: 'b30', bonusStreak: 'b21', guide: 'guide' },
  roles: { streak: 'feu', weekWinner: 'p7', monthWinner: 'p30', prisoner: 'pri' },
  streakRoleDays: 21,
  adminIds: new Set(['900']),
};

describe('aperçu', () => {
  it('prépare un exemple de chaque message, chacun publiable sur Discord', () => {
    const examples = previewMessages(config, Date.UTC(2026, 9, 28, 12));
    assert.equal(examples.length, 18);
    for (const [where, content] of examples) {
      assert.ok(where.length > 0);
      assert.ok(content.includes('<@900>') || content.includes('<#'), where);
      assert.ok(splitMessage(content).length >= 1);
    }
    assert.match(examples.find(([where]) => where.startsWith('top-30 — lancement'))[1], /octobre 2026/);
  });
});
