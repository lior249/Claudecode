import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allTimeLeaderboard,
  chainLength,
  isProof,
  prisonLeaderboard,
  prisonLevel,
  prisonState,
  trackingStartDay,
  weeklyLeaderboard,
} from '../src/stats.js';
import { DAY_MS, dayOf, weekRange, weekStart } from '../src/time.js';

const days = (...list) => new Set(list);

describe('time', () => {
  it('les semaines commencent le dimanche à 18 h UTC', () => {
    assert.equal(weekStart(Date.UTC(2026, 9, 28, 12)), Date.UTC(2026, 9, 25, 18));
    assert.equal(weekStart(Date.UTC(2026, 10, 1, 17, 59)), Date.UTC(2026, 9, 25, 18));
    assert.equal(weekStart(Date.UTC(2026, 10, 1, 18)), Date.UTC(2026, 10, 1, 18));
    const { start, end } = weekRange(Date.UTC(2026, 9, 28));
    assert.equal(end - start, 7 * DAY_MS);
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
});

describe('prisonState', () => {
  it('entre en prison après 3 jours entiers sans show-up', () => {
    assert.equal(prisonState(days(10), 10, 13).inPrison, false);
    const state = prisonState(days(10), 10, 14);
    assert.equal(state.inPrison, true);
    assert.equal(state.entryDay, 14);
    assert.equal(state.missed, 3);
  });

  it("un membre qui n'a jamais posté entre en prison 3 jours après le début du suivi", () => {
    assert.equal(prisonState(days(), 20, 22).inPrison, false);
    assert.equal(prisonState(days(), 20, 23).inPrison, true);
  });

  it("sort de prison au 3e jour de show-up d'affilée, dès le post", () => {
    // Dernier show-up le jour 10, prison le jour 14, puis show-ups les jours 14, 15, 16.
    assert.equal(prisonState(days(10, 14, 15), 10, 15).inPrison, true);
    assert.equal(prisonState(days(10, 14, 15), 10, 15).daysToLeave, 1);
    assert.equal(prisonState(days(10, 14, 15, 16), 10, 16).inPrison, false);
  });

  it("reste en prison sans 3 jours d'affilée", () => {
    const state = prisonState(days(10, 14, 16, 18, 20), 10, 21);
    assert.equal(state.inPrison, true);
    // Le jour 20 compte : il lui reste aujourd'hui et demain.
    assert.equal(state.daysToLeave, 2);
  });

  it('compte les jours sans show-up pour les paliers', () => {
    const state = prisonState(days(10), 10, 21);
    assert.equal(state.missed, 10);
    assert.equal(prisonLevel(state.missed), 10);
  });
});

describe('prisonLevel', () => {
  it('donne le palier atteint', () => {
    assert.equal(prisonLevel(2), 0);
    assert.equal(prisonLevel(3), 3);
    assert.equal(prisonLevel(7), 6);
    assert.equal(prisonLevel(14), 10);
    assert.equal(prisonLevel(29), 15);
    assert.equal(prisonLevel(45), 30);
  });
});

describe('classements', () => {
  const free = { inPrison: false };
  const rows = [
    { userId: 'a', category: 'free', prison: free, week: 5, weekReachedAt: 30, total: 20, totalReachedAt: 30 },
    { userId: 'b', category: 'free', prison: free, week: 5, weekReachedAt: 10, total: 40, totalReachedAt: 10 },
    { userId: 'c', category: 'free', prison: free, week: 5, weekReachedAt: 20, total: 40, totalReachedAt: 20 },
    { userId: 'd', category: 'plug', prison: free, week: 9, weekReachedAt: 5, total: 90, totalReachedAt: 5 },
    {
      userId: 'e',
      category: 'free',
      prison: { inPrison: true, entryDay: 95, missed: 5 },
      week: 0,
      weekReachedAt: 0,
      total: 99,
      totalReachedAt: 1,
    },
    { userId: 'f', category: 'free', prison: free, week: 0, weekReachedAt: 0, total: 0, totalReachedAt: 0 },
  ];

  it('départage la semaine par le total, puis par celui qui a atteint son score le premier', () => {
    assert.deepEqual(
      weeklyLeaderboard(rows, 'free').map((e) => e.userId),
      ['b', 'c', 'a'],
    );
  });

  it('exclut les membres en prison et ceux qui ont 0 point', () => {
    assert.deepEqual(
      allTimeLeaderboard(rows, 'free').map((e) => e.userId),
      ['b', 'c', 'a'],
    );
  });

  it('sépare les catégories', () => {
    assert.deepEqual(
      weeklyLeaderboard(rows, 'plug').map((e) => e.userId),
      ['d'],
    );
  });

  it('classe la prison par ancienneté', () => {
    assert.deepEqual(prisonLeaderboard(rows, 'free', 100), [{ userId: 'e', score: 6, missed: 5 }]);
  });
});
