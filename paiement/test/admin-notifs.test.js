'use strict';

// Espace notifications du coach : journal des messages de Bob, Mes rappels (envoyés à l'heure GMT), alerte de réservation ;
// suivre un membre depuis son profil du classement.
const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { creerBob } = require('../src/bob');
const { texteDe, lienDe } = require('../src/admin-notifs');

test('journal : texte lisible, lien vers la page sans le jeton', () => {
  assert.strictEqual(texteDe('**Awa** (<@123>) a envoyé son **compte rendu**.'), 'Awa a envoyé son compte rendu.');
  const contenu = { content: 'x', components: [{ components: [{ data: { url: 'https://overmaxx.online/connexion/bob?t=SECRET&retour=%2Fadmin%2Fcomptes-rendus%2F4' } }] }] };
  assert.strictEqual(lienDe(contenu), '/admin/comptes-rendus/4');
});

test('notifications du coach : 2 onglets, rappels envoyés à l\'heure, réservation signalée, non lues', async () => {
  const m = await monter();
  try {
    let now = new Date('2026-12-02T07:59:00Z'); // mercredi
    const dms = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content || c]) }) } }, serveur: { members: { fetch: async () => null } } });
    const admin = { cookie: cookieSession(ADMIN, 'coach') };

    // Un rappel chaque jour à 08:00 GMT, un le mercredi à 10:00, un mauvais (sans heure).
    assert.strictEqual((await m.poster('/admin/rappels', { texte: 'Vérifier les coachings du jour', frequence: 'jour', heure: '08:00' }, admin)).headers.get('location'), '/notifications?onglet=rappels&fait=ajoute');
    await m.poster('/admin/rappels', { texte: 'Préparer l\'événement', frequence: 'semaine', jours: '3', heure: '10:00' }, admin);
    assert.match((await m.poster('/admin/rappels', { texte: 'x', frequence: 'jour', heure: '' }, admin)).headers.get('location'), /erreur=/);
    const rappels = await (await m.get('/notifications?onglet=rappels', admin)).text();
    assert.match(rappels, /Vérifier les coachings du jour[\s\S]*Chaque jour à 08:00 GMT/);
    assert.match(rappels, /Mercredi à 10:00 GMT/);

    await bob.rappelsAdmin();
    assert.strictEqual(dms.length, 0, '07:59 : pas encore');
    now = new Date('2026-12-02T08:03:00Z');
    await bob.rappelsAdmin(); await bob.rappelsAdmin();
    assert.strictEqual(dms.filter(([, t]) => /Rappel.*Vérifier les coachings/.test(t)).length, 1, 'une fois par jour');
    now = new Date('2026-12-02T10:10:00Z');
    await bob.rappelsAdmin();
    assert.ok(dms.some(([, t]) => /Préparer l'événement/.test(t)));

    // Réservation d'une semaine de coaching : le coach est prévenu.
    await bob.seances.semaineReservee('E1', [{ date: '2026-12-07', heure: '14:00' }]);
    assert.ok(dms.some(([id, t]) => id === ADMIN && /Coaching réservé[\s\S]*07\/12\/2026 à 14:00 GMT/.test(t)));

    // Onglet Notifications : tout y est, non lu (badge), puis lu après ouverture.
    assert.strictEqual(bob.notifsAdmin.nonLues(), 3);
    const page = await (await m.get('/notifications', admin)).text();
    assert.match(page, /aria-current="page">Notifications/);
    assert.match(page, /Coaching réservé[\s\S]*Ouvrir/);
    assert.strictEqual(bob.notifsAdmin.nonLues(), 0);
    // Les réglages de l'application restent accessibles.
    assert.match(await (await m.get('/notifications?onglet=reglages', admin)).text(), /Notifications/);
  } finally { await m.fermer(); }
});

test('profil du classement : Suivre puis Ne plus suivre, retour sur le profil', async () => {
  const m = await monter();
  try {
    for (const id of ['A', 'B']) { m.parcours.assurer(id, { pseudo: `p_${id}` }); }
    const a = { cookie: cookieSession('A', 'p_A') };
    const profil = await (await m.get('/classement/B', a)).text();
    assert.match(profil, /action="\/communaute\/suivre"[\s\S]*>Suivre</);
    const r = await m.poster('/communaute/suivre', { id: 'B', retour: '/classement/B' }, a);
    assert.strictEqual(r.headers.get('location'), '/classement/B?fait=suivi');
    assert.match(await (await m.get('/classement/B', a)).text(), /Ne plus suivre/);
    assert.strictEqual((await m.poster('/communaute/suivre', { id: 'B', retour: 'https://evil.com' }, a)).headers.get('location'), '/communaute?fait=suivi');
  } finally { await m.fermer(); }
});
