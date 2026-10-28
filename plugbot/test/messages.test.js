import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  frenchList,
  ordinal,
  plural,
  prisonLevelMessages,
  prisonWarningMessages,
  rankingMessage,
  showupMessage,
  splitMessage,
  streakRewardMessage,
} from '../src/messages.js';

const config = {
  channels: { results: 'res' },
  prisonExitChannelId: 'exit',
  roles: { streak: 'feu', weekWinner: 'p7', monthWinner: 'p30', prisoner: 'pri' },
  streakRoleDays: 21,
};

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

  it('annonce le rôle de chaîne et sa réduction', () => {
    assert.equal(
      streakRewardMessage('1', config),
      "🔥 <@1> atteint **21 jours d'affilée** et débloque <@&feu> : −15 % sur la formation !",
    );
  });

  it("alerte 5 jours avant la prison en disant ce qui va arriver", () => {
    const [text] = prisonWarningMessages(['1', '2'], config);
    assert.match(text, /^⚠️ <@1> et <@2> : 10 jours sans show-up\./);
    assert.match(text, /Encore 5 jours sans résultat et c'est la prison : le rôle <@&pri>/);
    assert.match(text, /<@&feu>, <@&p7>, <@&p30>/);
    assert.match(text, /Un seul résultat dans <#res> suffit/);
  });

  it('regroupe les entrées en prison et explique comment sortir', () => {
    assert.deepEqual(prisonLevelMessages(15, ['1'], config), [
      "🔒 <@1> vient d'entrer en prison : 15 jours sans show-up.\n" +
        "Pour sortir : 3 jours de show-up d'affilée dans <#res>, ou un ticket dans <#exit> pour justifier ton absence.",
    ]);
    assert.match(prisonLevelMessages(30, ['1', '2'], config)[0], /^🔒 <@1> et <@2> sont définitivement en prison/);
  });

  it('découpe les longues listes sous la limite de Discord', () => {
    const ids = Array.from({ length: 290 }, (_, i) => String(100000000000000000n + BigInt(i)));
    const messages = prisonLevelMessages(15, ids, config);
    assert.equal(messages.length, 6);
    for (const message of messages) assert.ok(message.length <= 2000);
  });

  it('publie le classement avec les deux catégories et les gagnants', () => {
    const text = rankingMessage({
      kind: 'week',
      title: 'Classement de la semaine',
      congrats: 'Bravo !',
      sections: [
        { category: 'free', entries: [{ userId: '1', score: 12 }, { userId: '2', score: 1 }] },
        { category: 'plug', entries: [] },
      ],
      winners: ['1'],
      config,
    });
    assert.equal(
      text,
      [
        '⚡ **Classement de la semaine**',
        'Bravo !',
        '',
        '**Free**',
        '1. <@1> — 12 points',
        '2. <@2> — 1 point',
        '',
        '**Plug**',
        '_Personne pour cette période._',
        '',
        '⚡ <@1> remporte <@&p7> : −25 % sur la formation !',
      ].join('\n'),
    );
  });

  it('découpe un texte trop long sans couper les lignes', () => {
    const line = 'x'.repeat(900);
    const parts = splitMessage([line, line, line].join('\n'));
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.length <= 2000));
  });
});
