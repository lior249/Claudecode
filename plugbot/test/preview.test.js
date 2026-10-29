import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitMessage } from '../src/messages.js';
import { PREVIEW_PREFIX, isPreviewMessage, previewMessages } from '../src/preview.js';

const config = {
  channels: { results: 'res', month: 'top30', allTime: 'alltime' },
  links: { bonusWeek: 'b7', bonusMonth: 'b30', bonusStreak: 'b21', guide: 'guide' },
  roles: { streak: 'feu', weekWinner: 'p7', monthWinner: 'p30', prisoner: 'pri' },
  streakRoleDays: 21,
  adminIds: new Set(['900']),
};

describe('aperçu', () => {
  it('prépare un exemple de chaque message, chacun publiable sur Discord', () => {
    const examples = previewMessages(config, Date.UTC(2026, 9, 28, 12));
    assert.equal(examples.length, 19);
    for (const [where, content] of examples) {
      assert.ok(where.length > 0);
      if (content.embed) {
        assert.match(content.embed.fields[1].value, /<@900>/, where);
        continue;
      }
      assert.ok(content.includes('<@900>') || content.includes('<#'), where);
      assert.ok(splitMessage(content).length >= 1);
    }
    assert.equal(examples.filter(([, content]) => content.embed).length, 3, 'un classement en direct par salon top');
    assert.match(examples.find(([where]) => where.startsWith('top-30 — lancement'))[1], /octobre 2026/);
  });

  it("n'efface que les messages d'aperçu publiés par PlugBot", () => {
    const preview = `${PREVIEW_PREFIX}top-7 — lancement**\n@everyone`;
    assert.ok(isPreviewMessage({ author: { id: 'bot' }, content: preview }, 'bot'));
    assert.ok(!isPreviewMessage({ author: { id: 'bot' }, content: '@everyone\n⚡ **Classement de la semaine**' }, 'bot'));
    assert.ok(!isPreviewMessage({ author: { id: 'membre' }, content: preview }, 'bot'));
  });
});
