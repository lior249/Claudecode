import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allTimeMessage,
  challengeLaunchMessage,
  frenchList,
  ordinal,
  plural,
  prisonEntryMessages,
  prisonFinalMessages,
  prisonWarningMessages,
  rankingMessage,
  showupMessage,
  splitMessage,
  standingsMessage,
  streakRewardMessage,
} from '../src/messages.js';

const config = {
  channels: { results: 'res' },
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
    assert.doesNotMatch(text, /Accompagnement/);
  });

  it("affiche le rang de l'accompagnement", () => {
    const text = showupMessage({ userId: '1', chain: 2, week: 3, total: 3, rank: 1, category: 'plug', prison: { inPrison: false } });
    assert.match(text, /\(1er Accompagnement\)/);
  });

  it('annonce le rôle de chaîne et sa réduction', () => {
    assert.equal(
      streakRewardMessage('1', config),
      "🔥 <@1> atteint **21 jours d'affilée** et débloque <@&feu> : −15 % sur la formation !",
    );
  });

  it("alerte 5 jours avant la prison, puis liste les membres concernés", () => {
    assert.deepEqual(prisonWarningMessages(['1', '2'], config), [
      [
        '⚠️ **Alerte : tu vas en prison.**',
        "Dans 5 jours, tu iras en prison, parce que tu n'as posté aucun résultat montrant que tu es actif sur TikTok.",
        'Si tu veux éviter ça, poste une vidéo et envoie le résultat dans les 5 jours qui viennent. Sinon, tu rejoindras la prison.',
        '(La prison te coupe tous les accès principaux du Discord : écrire dans les salons, rejoindre les lives, accéder aux réductions, etc.)',
        'Pour éviter que ça arrive, envoie juste un seul résultat dans <#res>, le plus vite possible.',
        '',
        "Voici tous ceux qui iront en prison dans 5 jours s'ils ne postent aucun résultat :",
        '<@1> <@2>',
      ].join('\n'),
    ]);
  });

  it("continue la liste de l'alerte dans d'autres messages si elle est trop longue", () => {
    const ids = Array.from({ length: 120 }, (_, i) => String(100000000000000000n + BigInt(i)));
    const messages = prisonWarningMessages(ids, config);
    assert.equal(messages.length, 3);
    assert.match(messages[0], /^⚠️/);
    assert.match(messages[1], /^<@/);
    for (const message of messages) assert.ok(message.length <= 2000);
  });

  it('annonce les entrées en prison avec le délai et la seule façon de sortir', () => {
    assert.deepEqual(prisonEntryMessages(21, ['1'], config), [
      "🔒 <@1> vient d'entrer en prison : 21 jours sans show-up.\nPour sortir : 3 jours de show-up d'affilée dans <#res>.",
    ]);
    assert.match(prisonEntryMessages(15, ['1', '2'], config)[0], /^🔒 <@1> et <@2> viennent d'entrer en prison : 15 jours/);
    assert.match(prisonFinalMessages(['1', '2'], config)[0], /^🔒 <@1> et <@2> sont définitivement en prison : 30 jours/);
  });

  it('découpe les longues listes sous la limite de Discord', () => {
    const ids = Array.from({ length: 290 }, (_, i) => String(100000000000000000n + BigInt(i)));
    const messages = prisonEntryMessages(21, ids, config);
    assert.equal(messages.length, 6);
    for (const message of messages) assert.ok(message.length <= 2000);
  });

  it("publie l'accompagnement avant les Free, et seul le gagnant Free gagne la réduction", () => {
    const text = rankingMessage({
      kind: 'week',
      title: 'Classement de la semaine',
      congrats: 'Bravo !',
      sections: [
        { category: 'plug', entries: [{ userId: '3', score: 7 }] },
        { category: 'free', entries: [{ userId: '1', score: 12 }, { userId: '2', score: 1 }] },
      ],
      config,
    });
    assert.equal(
      text,
      [
        '⚡ **Classement de la semaine**',
        'Bravo !',
        '',
        '**Accompagnement**',
        '1. <@3> — 7 points',
        '',
        '**Free**',
        '1. <@1> — 12 points',
        '2. <@2> — 1 point',
        '',
        '🏆 <@3> remporte le classement Accompagnement !',
        '⚡ <@1> remporte <@&p7> : −25 % sur la formation !',
      ].join('\n'),
    );
  });

  it('indique une catégorie vide', () => {
    const text = rankingMessage({
      kind: 'month',
      title: 'Classement du mois — novembre 2026',
      congrats: 'Bravo !',
      sections: [
        { category: 'plug', entries: [] },
        { category: 'free', entries: [{ userId: '1', score: 30 }] },
      ],
      config,
    });
    assert.match(text, /\*\*Accompagnement\*\*\n_Personne pour cette période._/);
    assert.match(text, /★ <@1> remporte <@&p30> : −35 % sur la formation !$/);
  });

  it('annonce que le challenge de la semaine est en pause entre dimanche 18 h et lundi 18 h', () => {
    const text = showupMessage({ userId: '1', chain: 3, week: 0, total: 9, rank: 0, category: 'free', prison: { inPrison: false }, weekOpen: false });
    assert.match(text, /Semaine : le challenge reprend lundi à 18 h · 🏅 Total : \*\*9 points\*\*/);
  });

  it('lance le challenge de la semaine le lundi', () => {
    const text = challengeLaunchMessage({ kind: 'week', end: Date.UTC(2026, 10, 8, 18), config });
    assert.equal(
      text,
      [
        '⚡ **Le challenge de la semaine est lancé !**',
        "Jusqu'à dimanche 18 h (UTC), chaque résultat posté dans <#res> te rapporte 1 point.",
        'Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement est mis à jour tous les soirs.',
        'Accompagnement et Free ont chacun leur classement.',
        '',
        '⚡ Le meilleur Free de la semaine remporte <@&p7> : −25 % sur la formation !',
      ].join('\n'),
    );
  });

  it('lance le challenge du mois le 1er', () => {
    const text = challengeLaunchMessage({ kind: 'month', end: Date.UTC(2026, 10, 30, 18), config });
    assert.match(text, /^★ \*\*Le challenge du mois de novembre 2026 est lancé !\*\*/);
    assert.match(text, /\nJusqu'au 30 novembre à 18 h \(UTC\), chaque résultat/);
    assert.match(text, /participe à ce challenge pour obtenir tes résultats/);
    assert.match(text, /<@&p30> : −35 %/);
  });

  it('publie le point du jour avec les jours restants', () => {
    const text = standingsMessage({
      kind: 'week',
      sections: [
        { category: 'plug', entries: [] },
        { category: 'free', entries: [{ userId: '1', score: 4 }] },
      ],
      daysLeft: 5,
      end: Date.UTC(2026, 10, 8, 18),
      config,
    });
    assert.match(text, /^⚡ \*\*Challenge de la semaine — classement du jour\*\*\nPlus que 5 jours avant la fin, dimanche à 18 h \(UTC\)/);
    assert.match(text, /\*\*Accompagnement\*\*\n_Personne pour l'instant\. Sois le premier !_/);
    assert.match(text, /\*\*Free\*\*\n1\. <@1> — 4 points/);
    assert.match(standingsMessage({ kind: 'week', sections: [], daysLeft: 1, end: 0, config }), /Dernier jour avant la fin/);
  });

  it('publie le top all-time', () => {
    const text = allTimeMessage({ sections: [{ category: 'plug', entries: [{ userId: '3', score: 140 }] }, { category: 'free', entries: [] }] });
    assert.match(text, /^👑 \*\*Classement all-time\*\*/);
    assert.match(text, /\*\*Accompagnement\*\*\n1\. <@3> — 140 points/);
  });

  it('découpe un texte trop long sans couper les lignes', () => {
    const line = 'x'.repeat(900);
    const parts = splitMessage([line, line, line].join('\n'));
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.length <= 2000));
  });
});
