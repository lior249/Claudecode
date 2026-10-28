import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayOf, dueAnnouncement, nextLive } from '../src/schedule.js';

// Mercredi 28 octobre 2026 et vendredi 30 octobre 2026.
const wednesday = (hour, minute = 0) => Date.UTC(2026, 9, 28, hour, minute);
const thursday = Date.UTC(2026, 9, 29, 12);
const friday = Date.UTC(2026, 9, 30, 12);

describe('calendrier', () => {
  it('annonce le mercredi et le vendredi à 12 h, pour le live de 22 h', () => {
    assert.equal(dueAnnouncement(wednesday(11, 59), null), null);
    assert.deepEqual(dueAnnouncement(wednesday(12), null), { day: dayOf(wednesday(12)), liveAt: wednesday(22) });
    assert.ok(dueAnnouncement(friday, null));
    assert.equal(dueAnnouncement(thursday, null), null);
  });

  it("n'annonce qu'une fois par jour", () => {
    assert.equal(dueAnnouncement(wednesday(12, 1), dayOf(wednesday(12))), null);
  });

  it("rattrape l'annonce après une coupure, mais pas une fois le live commencé", () => {
    assert.ok(dueAnnouncement(wednesday(18), null));
    assert.equal(dueAnnouncement(wednesday(22), null), null);
  });

  it('trouve le prochain live', () => {
    assert.equal(nextLive(wednesday(23)), Date.UTC(2026, 9, 30, 22));
    assert.equal(nextLive(wednesday(10)), wednesday(22));
  });
});
