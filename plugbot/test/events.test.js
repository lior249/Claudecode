import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIVE_TYPES } from '../src/events/catalog.js';
import { formatDateTime, parseDate, parseDuration, parseTime } from '../src/events/format.js';
import { readInfoForm } from '../src/events/interactions.js';
import { eventMessage, mentions, missingFields, presentation, ticketSummary } from '../src/events/render.js';
import { confirmationSlot, planningSlot, recurringLivesOfWeek, reminderSchedule } from '../src/events/schedule.js';
import { panelMessage, settingsMessage } from '../src/events/ui.js';
import { localTimeLines } from '../src/events/zones.js';

const HOUR = 60 * 60 * 1000;
const config = { roles: { free: 'r-free', plug: 'r-tiktok' } };
// Jeudi 5 novembre 2026, 22 h GMT.
const START = Date.UTC(2026, 10, 5, 22);
const baseEvent = {
  id: 1,
  type: 'masterclass',
  audience: 'free',
  title: 'Les accroches qui retiennent',
  startAt: START,
  durationMin: 60,
  details: '',
  template: 0,
  locationChannel: 'vocal',
  locationUrl: null,
  roles: ['everyone'],
  reminders: ['creation', '7d', '3d', '24h', '3h'],
  status: 'draft',
  discordEventId: 'ev1',
};

describe('événements — calendrier', () => {
  it('programme les rappels cochés qui ne sont pas encore passés, plus le sondage de fin', () => {
    const now = Date.UTC(2026, 9, 31, 12); // 5 jours avant : « 7 jours avant » est déjà passé
    assert.deepEqual(reminderSchedule(baseEvent, now), [
      { kind: '3d', sendAt: START - 72 * HOUR },
      { kind: '24h', sendAt: START - 24 * HOUR },
      { kind: '3h', sendAt: START - 3 * HOUR },
      { kind: 'feedback', sendAt: START + HOUR },
    ]);
    assert.deepEqual(
      reminderSchedule({ ...baseEvent, reminders: ['creation'] }, now).map((r) => r.kind),
      ['feedback'],
    );
  });

  it('demande le planning le dimanche à 9 h, 15 h et 18 h, puis le lundi', () => {
    assert.equal(planningSlot(Date.UTC(2026, 10, 1, 8, 59)), null);
    const sunday = planningSlot(Date.UTC(2026, 10, 1, 9));
    assert.equal(sunday.week, Math.floor(Date.UTC(2026, 10, 2) / (24 * HOUR)));
    assert.equal(planningSlot(Date.UTC(2026, 10, 1, 16)).slot, Date.UTC(2026, 10, 1, 15));
    assert.equal(planningSlot(Date.UTC(2026, 10, 2, 18, 30)).week, sunday.week);
    assert.equal(planningSlot(Date.UTC(2026, 10, 3, 12)), null);
  });

  it('pose la question du live de l’accompagnement le mercredi et le vendredi, à 9 h, 12 h et 15 h', () => {
    assert.equal(confirmationSlot(Date.UTC(2026, 9, 28, 8)), null);
    assert.deepEqual(confirmationSlot(Date.UTC(2026, 9, 28, 13)), {
      day: Math.floor(Date.UTC(2026, 9, 28) / (24 * HOUR)),
      liveAt: Date.UTC(2026, 9, 28, 22),
      slot: Date.UTC(2026, 9, 28, 12),
    });
    assert.ok(confirmationSlot(Date.UTC(2026, 9, 30, 9)));
    assert.equal(confirmationSlot(Date.UTC(2026, 9, 29, 9)), null, 'pas de live le jeudi');
    assert.deepEqual(recurringLivesOfWeek(Math.floor(Date.UTC(2026, 10, 2) / (24 * HOUR))), [
      Date.UTC(2026, 10, 4, 22),
      Date.UTC(2026, 10, 6, 22),
    ]);
  });
});

describe('événements — saisie', () => {
  const now = Date.UTC(2026, 9, 29, 10);
  it('lit les dates, heures et durées tapées à la main', () => {
    assert.equal(parseDate('05/11', now), Date.UTC(2026, 10, 5));
    assert.equal(parseDate('01/10', now), Date.UTC(2027, 9, 1), "une date passée, c'est l'année suivante");
    assert.equal(parseDate('31/02', now), null);
    assert.equal(parseTime('22h'), 22 * HOUR);
    assert.equal(parseTime('9:05'), 9 * HOUR + 5 * 60 * 1000);
    assert.equal(parseTime('25:00'), null);
    assert.equal(parseDuration('1h30'), 90);
    assert.equal(parseDuration('45 min'), 45);
    assert.equal(formatDateTime(START), 'jeudi 5 novembre à 22 h 00 (GMT)');
  });

  it('refuse un formulaire mal rempli en expliquant pourquoi', () => {
    const { errors } = readInfoForm({ title: ' ', date: '32/11', time: 'demain', duration: '60', details: '' }, now);
    assert.equal(errors.length, 3);
    const { changes } = readInfoForm({ title: 'Masterclass', date: '5/11', time: '22:00', duration: '90', details: ' Hello ' }, now);
    assert.deepEqual(changes, { title: 'Masterclass', startAt: START, durationMin: 90, details: 'Hello' });
  });

  it('dit ce qui manque avant de valider', () => {
    assert.deepEqual(missingFields({ ...baseEvent, audience: null, title: null, startAt: null, locationChannel: null }, 0), [
      'le public',
      'le sujet',
      "la date et l'heure",
      'le lieu',
    ]);
    assert.deepEqual(missingFields(baseEvent, START + 1), ['une date et une heure à venir']);
  });
});

describe('événements — messages', () => {
  it('mentionne les rôles choisis et autorise leur notification', () => {
    assert.deepEqual(mentions(['everyone', 'plug'], config), {
      text: '@everyone <@&r-tiktok>',
      allowedMentions: { parse: ['everyone'], roles: ['r-tiktok'] },
    });
  });

  it("rédige l'annonce avec le modèle, l'heure chez soi et le lien de l'événement", () => {
    const text = eventMessage('creation', { ...baseEvent, details: 'On voit 5 exemples.' }, { config, guildId: 'g' });
    assert.match(text, /^@everyone\n🎓 \*\*Masterclass — Les accroches qui retiennent\*\*\nUne masterclass, un sujet/);
    assert.match(text, /\n\nOn voit 5 exemples\.\n\n📅 jeudi 5 novembre à 22 h 00 \(GMT\)\n📍 <#vocal>/);
    assert.match(text, /\*\*22 h 00\*\* — 🇸🇳 Sénégal/);
    assert.match(text, /https:\/\/discord\.com\/events\/g\/ev1$/);
  });

  it('rédige chaque rappel', () => {
    const context = { config, guildId: 'g' };
    assert.match(eventMessage('7d', baseEvent, context), /Dans une semaine/);
    assert.match(eventMessage('3d', baseEvent, context), /Plus que 3 jours/);
    assert.match(eventMessage('24h', baseEvent, context), /C'est demain !/);
    assert.match(eventMessage('3h', baseEvent, context), /\*\*Dans 3 heures !\*\* 🎓 \*\*Les accroches qui retiennent\*\* commence à 22 h 00 \(GMT\)/);
    assert.match(eventMessage('cancellation', baseEvent, context), /est annulé/);
    assert.match(eventMessage('creation', { ...baseEvent, locationChannel: null, locationUrl: 'https://youtu.be/x' }, context), /📍 https:\/\/youtu\.be\/x/);
  });

  it('a un texte pour chaque type et chaque public', () => {
    for (const type of LIVE_TYPES) {
      for (const [audience, texts] of Object.entries(type.texts)) {
        assert.ok(texts.length > 0, `${type.key} ${audience}`);
        assert.ok(presentation({ type: type.key, audience, template: 0, details: '' }).length > 10);
      }
    }
    assert.equal(LIVE_TYPES.find((type) => type.key === 'decouverte').texts.free.length, 3);
  });

  it('montre 5 pays au maximum par heure', () => {
    for (const line of localTimeLines(START)) assert.ok(line.split(' · ').length <= 5, line);
  });

  it('résume le ticket', () => {
    const summary = ticketSummary(baseEvent, { guildId: 'g' });
    assert.match(summary, /^🎫 \*\*🎓 Masterclass\*\*\n\*\*Public :\*\* Free\n\*\*Sujet :\*\* Les accroches qui retiennent/);
    assert.match(summary, /\*\*Rappels :\*\* à la création \(annonce\), 7 jours avant, 3 jours avant, 24 heures avant, 3 heures avant/);
  });

  it('tient dans les limites de Discord (5 lignes de composants par message)', () => {
    assert.equal(panelMessage().components.length, 5);
    assert.equal(settingsMessage({ ...baseEvent, type: 'decouverte' }).components.length, 5);
    assert.equal(settingsMessage({ ...baseEvent, type: 'coaching' }).components.length, 4, 'un seul public : pas de menu Public');
    assert.equal(settingsMessage({ ...baseEvent, status: 'done' }).components.length, 0);
  });
});
