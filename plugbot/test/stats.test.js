import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PRISON_DAYS,
  chainLength,
  isProof,
  leaderboard,
  missedDays,
  needsWarning,
  trackingStartDay,
} from '../src/stats.js';
import {
  DAY_MS,
  dayAndMonth,
  dayOf,
  eveningDay,
  lastMonthEnd,
  lastWeekEnd,
  monthName,
  monthRange,
  weekRange,
} from '../src/time.js';

const days = (...list) => new Set(list);
const range = (from, to) => new Set(Array.from({ length: to - from + 1 }, (_, i) => from + i));

describe('time', () => {
  it('le challenge de la semaine va du dimanche 20 h 30 au dimanche 20 h 30 suivant, sans pause', () => {
    // Mercredi 28 octobre 2026.
    assert.deepEqual(weekRange(Date.UTC(2026, 9, 28, 12)), {
      start: Date.UTC(2026, 9, 25, 20, 30),
      end: Date.UTC(2026, 10, 1, 20, 30),
    });
    assert.equal(lastWeekEnd(Date.UTC(2026, 10, 1, 20, 29)), Date.UTC(2026, 9, 25, 20, 30));
    assert.equal(lastWeekEnd(Date.UTC(2026, 10, 1, 20, 30)), Date.UTC(2026, 10, 1, 20, 30));
    assert.equal(weekRange(Date.UTC(2026, 10, 1, 20, 30)).start, Date.UTC(2026, 10, 1, 20, 30));
  });

  it('le challenge du mois va du dernier jour du mois précédent à 20 h 30 au dernier jour à 20 h 30, sans pause', () => {
    assert.equal(lastMonthEnd(Date.UTC(2026, 9, 31, 20, 29)), Date.UTC(2026, 8, 30, 20, 30));
    assert.equal(lastMonthEnd(Date.UTC(2026, 9, 31, 20, 30)), Date.UTC(2026, 9, 31, 20, 30));
    assert.deepEqual(monthRange(Date.UTC(2026, 10, 15)), {
      start: Date.UTC(2026, 9, 31, 20, 30),
      end: Date.UTC(2026, 10, 30, 20, 30),
    });
    assert.deepEqual(monthRange(Date.UTC(2027, 0, 10)), {
      start: Date.UTC(2026, 11, 31, 20, 30),
      end: Date.UTC(2027, 0, 31, 20, 30),
    });
    assert.equal(monthName(Date.UTC(2026, 10, 30, 20, 30)), 'novembre 2026');
    assert.equal(dayAndMonth(Date.UTC(2026, 10, 30, 20, 30)), '30 novembre');
  });

  it('les jours changent à minuit UTC, et le soir à 20 h 30', () => {
    assert.equal(dayOf(Date.UTC(2026, 9, 28, 23, 59)) + 1, dayOf(Date.UTC(2026, 9, 29, 0, 0)));
    assert.equal(eveningDay(Date.UTC(2026, 9, 28, 20, 29)), dayOf(Date.UTC(2026, 9, 27)));
    assert.equal(eveningDay(Date.UTC(2026, 9, 28, 20, 30)), dayOf(Date.UTC(2026, 9, 28)));
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
  it("repart de zéro le lendemain d'un changement de rôle ou d'une libération", () => {
    assert.equal(trackingStartDay(10 * DAY_MS, 50, 80), 81);
  });
});

describe('missedDays', () => {
  it("compte les jours entiers sans show-up depuis le dernier, sans compter aujourd'hui", () => {
    assert.equal(missedDays(days(10), 1, 11), 0);
    assert.equal(missedDays(days(10), 1, 14), 3);
  });
  it('ne compte rien si le membre a posté aujourd\'hui', () => {
    assert.equal(missedDays(days(10, 14), 1, 14), 0);
  });
  it('commence au début du suivi pour un membre qui n\'a jamais posté', () => {
    assert.equal(missedDays(days(), 20, 41), 21);
    assert.equal(missedDays(days(5), 20, 30), 10);
  });
  it('plusieurs posts le même jour ne comptent que pour un jour', () => {
    assert.equal(missedDays(range(10, 20), 1, 21), 0);
  });
});

describe('needsWarning', () => {
  it("alerte 5 jours avant la prison : à 16 jours pour les Free, à 10 pour l'accompagnement", () => {
    assert.equal(needsWarning(15, PRISON_DAYS.free, 100, null), false);
    assert.equal(needsWarning(16, PRISON_DAYS.free, 100, null), true);
    assert.equal(needsWarning(9, PRISON_DAYS.plug, 100, null), false);
    assert.equal(needsWarning(10, PRISON_DAYS.plug, 100, null), true);
  });
  it('une seule alerte par absence', () => {
    assert.equal(needsWarning(17, 21, 101, 100), false);
    // Nouvelle absence commencée après la dernière alerte.
    assert.equal(needsWarning(16, 21, 140, 100), true);
  });
  it("pas d'alerte une fois le délai atteint", () => {
    assert.equal(needsWarning(21, 21, 100, null), false);
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
