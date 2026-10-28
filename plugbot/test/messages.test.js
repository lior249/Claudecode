import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allTimeMessage,
  challengeLaunchMessage,
  frenchList,
  monthReminderMessage,
  ordinal,
  plural,
  prisonEntryMessages,
  prisonFinalMessages,
  prisonWarningMessages,
  rankingMessage,
  showupMessage,
  splitMessage,
  standingsMessage,
  weeklyRecapMessage,
  winnerMessage,
} from '../src/messages.js';

const config = {
  channels: { results: 'res' },
  links: { bonusWeek: 'b7', bonusMonth: 'b30', bonusStreak: 'b21', guide: 'guide' },
  roles: { streak: 'feu', weekWinner: 'p7', monthWinner: 'p30', prisoner: 'pri' },
  streakRoleDays: 21,
};

const COACHING = "−35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement";

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

  it('annonce un show-up, une information par ligne, avec les rangs de la semaine, du mois et du total', () => {
    const text = showupMessage({
      userId: '1',
      chain: 12,
      category: 'free',
      prison: { inPrison: false },
      week: { points: 9, rank: 3 },
      month: { points: 31, rank: 44 },
      total: { points: 148, rank: 449 },
    });
    assert.equal(
      text,
      [
        '🔥 <@1> vient de show up !',
        "⛓️ Chaîne : **12 jours d'affilée**",
        '📅 Classement semaine : **9 points** — 3e du classement Free',
        '🗓️ Classement mois : **31 points** — 44e du classement Free',
        '🏅 Classement total : **148 points** — 449e du classement Free',
      ].join('\n'),
    );
  });

  it('rappelle combien de jours il reste pour sortir de prison', () => {
    const text = showupMessage({
      userId: '1',
      chain: 1,
      category: 'plug',
      prison: { inPrison: true, daysToLeave: 2 },
      week: { points: 1, rank: 0 },
      month: { points: 1, rank: 0 },
      total: { points: 30, rank: 0 },
    });
    assert.match(text, /Classement total : \*\*30 points\*\* — hors classement/);
    assert.match(text, /Toujours en prison : encore \*\*2 jours\*\*/);
  });

  it("affiche le rang de l'accompagnement", () => {
    const text = showupMessage({
      userId: '1',
      chain: 2,
      category: 'plug',
      prison: { inPrison: false },
      week: { points: 3, rank: 1 },
      month: { points: 3, rank: 1 },
      total: { points: 3, rank: 1 },
    });
    assert.match(text, /— 1er du classement Accompagnement/);
  });

  it('envoie chaque gagnant vers son salon bonus', () => {
    assert.equal(
      winnerMessage('monthWinner', '1', config),
      [
        '🎉 Hourra <@1> ! Tu viens de gagner le challenge du mois (top 30).',
        `Tu gagnes ${COACHING}.`,
        'Retrouve tes bénéfices dans <#b30>.',
      ].join('\n'),
    );
    assert.match(winnerMessage('weekWinner', '1', config), /le challenge de la semaine \(top 7\)\.\nTu gagnes −25 % sur la formation\.\n.*<#b7>/);
    assert.match(winnerMessage('streak', '1', config), /le challenge des 21 jours d'affilée \(🔥🔥🔥\)\.\nTu gagnes −15 % sur la formation\.\n.*<#b21>/);
  });

  it('récapitule les récompenses le dimanche, avec @everyone', () => {
    const text = weeklyRecapMessage(config);
    assert.match(text, /^@everyone\n🏆 \*\*Voici ce que tu gagnes en postant tes résultats sur la plateforme :\*\*/);
    assert.match(text, /★ \*\*Top 30\*\* : le top 30 récapitule les 10 meilleurs membres du serveur sur les 30 derniers jours\. Termine 1er du classement Free et tu gagnes le rôle <@&p30>, qui te débloque −35 %/);
    assert.match(text, /⚡ \*\*Top 7\*\* : .*<@&p7>, qui te débloque −25 % sur la formation\./);
    assert.match(text, /🔥 \*\*21 jours d'affilée\*\* : .*<@&feu>, qui te débloque −15 % sur la formation\./);
    assert.match(text, /⚠️ Attention : tous les membres inactifs qui ne passent pas à l'action vont intégrer la prison\./);
    assert.match(text, /Pour comprendre ces classements en détail, regarde <#guide>\.$/);
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

  it('annonce les entrées en prison, comment en sortir et où lire le guide', () => {
    assert.deepEqual(prisonEntryMessages(21, ['1', '2'], config), [
      [
        '🔒 **Tu viens de rejoindre la prison : 21 jours sans show-up.**',
        "Voici comment en sortir : poste un résultat dans <#res> pendant 3 jours d'affilée.",
        'Si tu veux plus de détails, va voir <#guide>.',
        '',
        'Voici ceux qui viennent de rejoindre la prison :',
        '<@1> <@2>',
      ].join('\n'),
    ]);
    assert.match(prisonEntryMessages(15, ['1'], config)[0], /^🔒 \*\*Tu viens de rejoindre la prison : 15 jours sans show-up\.\*\*/);
    assert.match(prisonFinalMessages(['1', '2'], config)[0], /^🔒 \*\*Définitivement en prison : 30 jours sans show-up\.\*\*[\s\S]*\n<@1> <@2>$/);
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
        '@everyone',
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
    assert.match(text, /★ <@1> remporte <@&p30> : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !$/);
  });

  it('lance le challenge de la semaine le lundi, avec @everyone', () => {
    const text = challengeLaunchMessage({ kind: 'week', start: Date.UTC(2026, 10, 1, 19, 45), end: Date.UTC(2026, 10, 8, 19, 45), config });
    assert.equal(
      text,
      [
        '@everyone',
        '⚡ **Le challenge de la semaine est lancé !**',
        "Depuis dimanche 19 h 45 et jusqu'à dimanche prochain 19 h 45 (GMT), chaque résultat posté dans <#res> te rapporte 1 point.",
        'Poste chaque jour pour montrer que tu es actif sur TikTok. Le classement est mis à jour tous les soirs.',
        'Accompagnement et Free ont chacun leur classement.',
        '',
        '⚡ Le meilleur Free de la semaine remporte <@&p7> : −25 % sur la formation !',
      ].join('\n'),
    );
  });

  it('lance le challenge du mois le 1er', () => {
    const text = challengeLaunchMessage({ kind: 'month', start: Date.UTC(2026, 9, 31, 19, 45), end: Date.UTC(2026, 10, 30, 19, 45), config });
    assert.match(text, /^@everyone\n★ \*\*Le challenge du mois de novembre 2026 est lancé !\*\*/);
    assert.match(text, /\nDepuis le 31 octobre à 19 h 45 et jusqu'au 30 novembre à 19 h 45 \(GMT\), chaque résultat/);
    assert.match(text, /participe à ce challenge pour obtenir tes résultats/);
    assert.match(text, /<@&p30> : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !$/);
  });

  it('rappelle le challenge du mois sans classement', () => {
    assert.equal(
      monthReminderMessage({ daysLeft: 20, end: Date.UTC(2026, 10, 30, 19, 45), config }),
      [
        '@everyone',
        '★ **Rappel : challenge du mois de novembre 2026**',
        'Plus que 20 jours avant la fin, le 30 novembre à 19 h 45 (GMT).',
        'Participe à ce challenge pour obtenir tes résultats : chaque résultat posté dans <#res> te rapporte 1 point.',
        '',
        "★ À la fin du mois, le meilleur Free remporte <@&p30> : −35 % sur la formation et une participation gratuite à un live coaching avec les membres de l'accompagnement !",
      ].join('\n'),
    );
  });

  it('publie le classement du jour avec les jours restants', () => {
    const text = standingsMessage({
      kind: 'week',
      sections: [
        { category: 'plug', entries: [] },
        { category: 'free', entries: [{ userId: '1', score: 4 }] },
      ],
      daysLeft: 5,
      end: Date.UTC(2026, 10, 8, 19, 45),
      config,
    });
    assert.match(text, /^@everyone\n⚡ \*\*Challenge de la semaine — classement du jour\*\*\nPlus que 5 jours avant la fin, dimanche à 19 h 45 \(GMT\)/);
    assert.match(text, /\*\*Accompagnement\*\*\n_Personne pour l'instant\. Sois le premier !_/);
    assert.match(text, /\*\*Free\*\*\n1\. <@1> — 4 points/);
    assert.match(standingsMessage({ kind: 'week', sections: [], daysLeft: 1, end: 0, config }), /Dernier jour avant la fin/);
  });

  it('publie le top all-time', () => {
    const text = allTimeMessage({ sections: [{ category: 'plug', entries: [{ userId: '3', score: 140 }] }, { category: 'free', entries: [] }] });
    assert.match(text, /^@everyone\n👑 \*\*Classement all-time\*\*/);
    assert.match(text, /\*\*Accompagnement\*\*\n1\. <@3> — 140 points/);
  });

  it('découpe un texte trop long sans couper les lignes', () => {
    const line = 'x'.repeat(900);
    const parts = splitMessage([line, line, line].join('\n'));
    assert.equal(parts.length, 2);
    assert.ok(parts.every((part) => part.length <= 2000));
  });
});
