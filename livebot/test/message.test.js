import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { announcement, localTimeLines } from '../src/message.js';

describe('annonce', () => {
  it("affiche l'heure du live dans chaque pays, du plus tôt au plus tard", () => {
    // Mercredi 28 octobre 2026, 22 h GMT : la France est à l'heure d'hiver.
    const lines = localTimeLines(Date.UTC(2026, 9, 28, 22));
    assert.match(lines[0], /^\*\*22 h 00\*\* — 🇸🇳 Sénégal · 🇲🇱 Mali/);
    assert.match(lines[1], /^\*\*23 h 00\*\* — 🇲🇦 Maroc .*🇫🇷 France · 🇧🇪 Belgique · 🇨🇭 Suisse$/);
    assert.match(lines[2], /^\*\*00 h 00 \(jeudi\)\*\* — 🇨🇩 RDC \(Lubumbashi\) · 🇷🇼 Rwanda · 🇧🇮 Burundi$/);
    assert.match(lines[3], /^\*\*01 h 00 \(jeudi\)\*\* — 🇩🇯 Djibouti · 🇰🇲 Comores · 🇲🇬 Madagascar$/);
    assert.match(lines[4], /^\*\*02 h 00 \(jeudi\)\*\* — 🇷🇪 La Réunion · 🇲🇺 Maurice$/);
  });

  it("suit le changement d'heure : en été, la France passe à minuit", () => {
    const lines = localTimeLines(Date.UTC(2026, 6, 1, 22)).join('\n');
    assert.match(lines, /\*\*00 h 00 \(jeudi\)\*\* — 🇫🇷 France · 🇧🇪 Belgique · 🇨🇭 Suisse · 🇨🇩 RDC \(Lubumbashi\)/);
  });

  it("mentionne le rôle et ferme le sondage au début du live", () => {
    const liveAt = Date.UTC(2026, 9, 28, 22);
    const { content, poll } = announcement({ liveAt, now: Date.UTC(2026, 9, 28, 12), roleId: '42' });
    assert.match(content, /^<@&42>\n🔴 \*\*Live ce soir — mercredi à 22 h 00 \(GMT\)\*\*/);
    assert.equal(poll.durationHours, 10);
    assert.deepEqual(poll.answers.map((answer) => answer.emoji), ['✅', '❌']);
    assert.ok(content.length <= 2000);
  });

  it('fonctionne sans rôle', () => {
    const { content } = announcement({ liveAt: Date.UTC(2026, 9, 30, 22), now: Date.UTC(2026, 9, 30, 12), roleId: null });
    assert.match(content, /^🔴 \*\*Live ce soir — vendredi/);
  });
});
