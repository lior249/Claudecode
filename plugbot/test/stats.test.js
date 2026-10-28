import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chainLength,
  isProof,
  leaderboard,
  needsWarning,
  prisonLevel,
  prisonState,
  trackingStartDay,
} from '../src/stats.js';
import { DAY_MS, dayOf, monthName, monthRange, monthStart, weekRange, weekStart } from '../src/time.js';

const days = (...list) => new Set(list);
const range = (from, to) => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));

describe('time', () => {
  it('les semaines commencent le dimanche à 18 h UTC', () => {
    assert.equal(weekStart(Date.UTC(2026, 9, 28, 12)), Date.UTC(2026, 9, 25, 18));
    assert.equal(weekStart(Date.UTC(2026, 10, 1, 17, 59)), Date.UTC(2026, 9, 25, 18));
    assert.equal(weekStart(Date.UTC(2026, 10, 1, 18)), Date.UTC(2026, 10, 1, 18));
    const { start, end } = weekRange(Date.UTC(2026, 9, 28));
    assert.equal(end - start, 7 * DAY_MS);
  });

  it('les mois se terminent le dernier jour à 18 h UTC', () => {
    assert.equal(monthStart(Date.UTC(2026, 9, 31, 17, 59)), Date.UTC(2026, 8, 30, 18));
    assert.equal(monthStart(Date.UTC(2026, 9, 31, 18)), Date.UTC(2026, 9, 31, 18));
    assert.deepEqual(monthRange(Date.UTC(2026, 10, 15)), {
      start: Date.UTC(2026, 9, 31, 18),
      end: Date.UTC(2026, 10, 30, 18),
    });
    assert.deepEqual(monthRange(Date.UTC(2027, 0, 10)), {
      start: Date.UTC(2026, 11, 31, 18),
      end: Date.UTC(2027, 0, 31, 18),
    });
    assert.equal(monthName(Date.UTC(2026, 10, 30, 18)), 'novembre 2026');
  });

  it('les jours changent à minuit UTC', () => {
    assert.equal(dayOf(Date.UTC(2026, 9, 28, 23, 59)) + 1, dayOf(Date.UTC(2026, 9, 29, 0, 0)));
  });
});

describe('isProof', () => {
  it('accepte les images et les vidéos', () => {
    assert.ok(isProof({ contentType: 'image/png', name: 'a.png' }));
    assert.ok(isProof({ contentType: 'video/mp4', name: 'a.mp4' }));
    assert.ok(isProof({ contentType: null, name: 'capture.JPG' }));
    assert.ok(!isProof({ contentType: 'application/pdf', name: 'a.pdf' }));
    assert.ok(!isProof({ contentType: null, name: 'notes.txt' }));
  });
});

describe('chainLength', () => {
  it("compte les jours d'affilée jusqu'à aujourd'hui", () => {
    assert.equal(chainLength(days(8, 9, 10), 10), 3);
  });
  it("reste vivante tant qu'aujourd'hui n'est pas fini", () => {
    assert.equal(chainLength(days(8, 9), 10), 2);
  });
  it('se brise après un jour manqué', () => {
    assert.equal(chainLength(days(5, 6, 7, 9), 10), 1);
    assert.equal(chainLength(days(5, 6, 7), 10), 0);
  });
});

describe('trackingStartDay', () => {
  it('attend 7 jours entiers sur le serveur', () => {
    const joinedAt = 100 * DAY_MS + 15 * 60 * 60 * 1000; // jour 100 à 15 h
    assert.equal(trackingStartDay(joinedAt, 50), 108);
  });
  it('commence le lendemain du lancement pour les anciens membres', () => {
    assert.equal(trackingStartDay(10 * DAY_MS, 50), 51);
    assert.equal(trackingStartDay(null, 50), 51);
  });
  it("repart de zéro le lendemain d'une libération par l'équipe", () => {
    assert.equal(trackingStartDay(10 * DAY_MS, 50, 80), 81);
  });
});

describe('prisonState', () => {
  it('entre en prison après 15 jours entiers sans show-up', () => {
    assert.equal(prisonState(days(10), 10, 25).inPrison, false);
    const state = prisonState(days(10), 10, 26);
    assert.equal(state.inPrison, true);
    assert.equal(state.entryDay, 26);
    assert.equal(state.missed, 15);
  });

  it("un membre qui n'a jamais posté entre en prison 15 jours après le début du suivi", () => {
    assert.equal(prisonState(days(), 20, 34).inPrison, false);
    assert.equal(prisonState(days(), 20, 35).inPrison, true);
  });

  it("sort de prison au 3e jour de show-up d'affilée, dès le post", () => {
    // Dernier show-up le jour 10, prison le jour 26, puis show-ups les jours 26, 27, 28.
    assert.equal(prisonState(days(10, 26, 27), 10, 27).inPrison, true);
    assert.equal(prisonState(days(10, 26, 27), 10, 27).daysToLeave, 1);
    assert.equal(prisonState(days(10, 26, 27, 28), 10, 28).inPrison, false);
  });

  it("reste en prison sans 3 jours d'affilée, même avec plusieurs posts le même jour", () => {
    const state = prisonState(days(10, 26, 28, 30, 32), 10, 33);
    assert.equal(state.inPrison, true);
    // Le jour 32 compte : il lui reste aujourd'hui et demain.
    assert.equal(state.daysToLeave, 2);
  });

  it('un membre régulier ne va jamais en prison', () => {
    assert.equal(prisonState(range(10, 60), 10, 60).inPrison, false);
  });
});

describe('prisonLevel', () => {
  it('donne le palier atteint', () => {
    assert.equal(prisonLevel(14), 0);
    assert.equal(prisonLevel(15), 15);
    assert.equal(prisonLevel(29), 15);
    assert.equal(prisonLevel(45), 30);
  });
});

describe('needsWarning', () => {
  const free = (missed) => ({ inPrison: false, missed });
  it('alerte à partir de 10 jours sans show-up', () => {
    assert.equal(needsWarning(free(9), 100, null), false);
    assert.equal(needsWarning(free(10), 100, null), true);
  });
  it('une seule alerte par absence', () => {
    assert.equal(needsWarning(free(11), 101, 100), false);
    // Nouvelle absence commencée après la dernière alerte.
    assert.equal(needsWarning(free(10), 140, 100), true);
  });
  it("pas d'alerte en prison", () => {
    assert.equal(needsWarning({ inPrison: true, missed: 12 }, 100, null), false);
  });
});

describe('leaderboard', () => {
  const free = { inPrison: false };
  const rows = [
    { userId: 'a', category: 'free', prison: free, points: 5, pointsReachedAt: 30, total: 20 },
    { userId: 'b', category: 'free', prison: free, points: 5, pointsReachedAt: 10, total: 40 },
    { userId: 'c', category: 'free', prison: free, points: 5, pointsReachedAt: 20, total: 40 },
    { userId: 'd', category: 'plug', prison: free, points: 9, pointsReachedAt: 5, total: 90 },
    { userId: 'e', category: 'free', prison: { inPrison: true }, points: 8, pointsReachedAt: 1, total: 99 },
    { userId: 'f', category: 'free', prison: free, points: 0, pointsReachedAt: 0, total: 0 },
  ];

  it('départage par le total, puis par celui qui a atteint son score le premier', () => {
    assert.deepEqual(
      leaderboard(rows, 'free').map((e) => e.userId),
      ['b', 'c', 'a'],
    );
  });

  it('exclut les membres en prison et ceux qui ont 0 point, et sépare les catégories', () => {
    assert.deepEqual(
      leaderboard(rows, 'plug').map((e) => e.userId),
      ['d'],
    );
    assert.ok(!leaderboard(rows, 'free').some((e) => e.userId === 'e' || e.userId === 'f'));
  });
});
