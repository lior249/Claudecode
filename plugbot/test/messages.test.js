import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  elogesMessage,
  frenchList,
  ordinal,
  plural,
  prisonLevelMessages,
  showupMessage,
  splitMessage,
} from '../src/messages.js';

describe('messages', () => {
  it('accorde le pluriel', () => {
    assert.equal(plural(1, 'point'), '1 point');
    assert.equal(plural(0, 'point'), '0 point');
    assert.equal(plural(4, 'jour'), '4 jours');
  });

  it('écrit les rangs', () => {
    assert.equal(ordinal(1), '1er');
    assert.equal(ordinal(3), '3e');
  });

  it('écrit les listes en français', () => {
    assert.equal(frenchList(['a']), 'a');
    assert.equal(frenchList(['a', 'b']), 'a et b');
    assert.equal(frenchList(['a', 'b', 'c']), 'a, b et c');
  });

  it('annonce un show-up avec la chaîne, la semaine, le rang et le total', () => {
    const text = showupMessage({
      userId: '1',
      chain: 12,
      week: 9,
      total: 148,
      rank: 3,
      category: 'free',
      prison: { inPrison: false },
    });
    assert.equal(
      text,
      "🔥 <@1> vient de show up !\n⛓️ Chaîne : **12 jours d'affilée** · 📅 Semaine : **9 points** (3e Free) · 🏅 Total : **148 points**",
    );
  });

  it('rappelle combien de jours il reste pour sortir de prison', () => {
    const text = showupMessage({
      userId: '1',
      chain: 1,
      week: 1,
      total: 30,
      rank: 0,
      category: 'plug',
      prison: { inPrison: true, daysToLeave: 2 },
    });
    assert.match(text, /Toujours en prison : encore \*\*2 jours\*\*/);
    assert.doesNotMatch(text, /Plug/);
  });

  it('regroupe les membres qui atteignent le même palier', () => {
    assert.deepEqual(prisonLevelMessages(3, ['1']), [
      "🔒 <@1> vient d'entrer en prison : aucun show-up depuis 3 jours.\nPour sortir : 3 jours de show-up d'affilée.",
    ]);
    assert.match(prisonLevelMessages(6, ['1', '2'])[0], /^🔒 <@1> et <@2> s'enfoncent dans la prison : 6 jours/);
  });

  it('découpe les longues listes de prison sous la limite de Discord', () => {
    const ids = Array.from({ length: 150 }, (_, i) => String(100000000000000000n + BigInt(i)));
    const messages = prisonLevelMessages(30, ids);
    assert.equal(messages.length, 3);
    for (const message of messages) assert.ok(message.length <= 2000);
  });

  it('publie les trois classements dans un seul message', () => {
    const text = elogesMessage({
      category: 'plug',
      congrats: 'Bravo !',
      weekly: [{ userId: '1', score: 12 }],
      allTime: [{ userId: '2', score: 148 }],
      prison: [{ userId: '3', score: 24 }],
    });
    assert.match(text, /Les éloges de la semaine — Plug/);
    assert.match(text, /1\. <@1> — 12 points/);
    assert.match(text, /1\. <@2> — 148 points/);
    assert.match(text, /1\. <@3> — en prison depuis 24 jours/);
    assert.ok(text.length <= 2000);
  });

  it('découpe un texte trop long sans couper les lignes', () => {
    const line = 'x'.repeat(900);
    const parts = splitMessage([line, line, line].join('\n'));
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.length <= 2000));
  });
});
