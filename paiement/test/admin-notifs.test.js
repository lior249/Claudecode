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

test('événement du coach : bannière en haut des pages (lien, couleur), notification facultative, retiré à la demande', async () => {
  const envois = [];
  const m = await monter({ bob: { parcours: { annonce: async (a, ids, image) => { envois.push([a, ids, image]); return ids.length; } } } });
  try {
    for (const id of ['A', 'B', 'C']) m.parcours.assurer(id, { pseudo: `p_${id}` });
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    assert.match(await (await m.get('/admin/annonces', coach)).text(), /3 élève\(s\) Elite[\s\S]*16:5[\s\S]*Ajouter un lien[\s\S]*Ajouter une image/);
    assert.match((await m.poster('/admin/annonces', { titre: 'x', texte: 'y', lien: 'javascript:alert(1)' }, coach)).headers.get('location'), /erreur=/);
    assert.strictEqual((await m.poster('/admin/annonces', { titre: 'x', texte: 'y' }, { cookie: cookieSession('A', 'p_A') })).status, 403);
    const r = await m.poster('/admin/annonces', { titre: 'Live ce soir', texte: 'Rendez-vous à 21 h.', lien: '/parcours/etape-4', notifier: '1', couleur: '#ff7a00', fin: '2099-01-01' }, coach);
    assert.strictEqual(r.headers.get('location'), '/admin/annonces?fait=1&n=3');
    assert.strictEqual(envois.length, 1);
    assert.deepStrictEqual(envois[0][1].sort(), ['A', 'B', 'C']);
    assert.strictEqual(envois[0][0].lien, '/parcours/etape-4');
    await new Promise((x) => setTimeout(x, 20));
    assert.match(await (await m.get('/admin/annonces', coach)).text(), /dans la bannière · reçu par 3 \/ 3/);
    const profil = await (await m.get('/profil', { cookie: cookieSession('A', 'p_A') })).text();
    assert.match(profil, /class="evts"[\s\S]*class="evt sans-image" style="--c:#ff7a00" href="\/parcours\/etape-4"[\s\S]*Live ce soir[\s\S]*Rendez-vous à 21 h\./);
    // Bannière seule (sans notification), puis retirée.
    await m.poster('/admin/annonces', { titre: 'Défi de la semaine', texte: '3 vidéos', fin: '2099-01-01' }, coach);
    assert.strictEqual(envois.length, 1, 'pas de notification');
    assert.match(await (await m.get('/classement', { cookie: cookieSession('A', 'p_A') })).text(), /Défi de la semaine[\s\S]*Live ce soir/);
    const id = m.db.prepare("SELECT id FROM annonces WHERE titre = 'Défi de la semaine'").get().id;
    await m.poster(`/admin/annonces/${id}/retirer`, {}, coach);
    assert.doesNotMatch(await (await m.get('/classement', { cookie: cookieSession('A', 'p_A') })).text(), /Défi de la semaine/);
  } finally { await m.fermer(); }
});

test('élève : pastilles rouges (9+) sur la cloche et la bulle, remises à zéro à l\'ouverture', async () => {
  const m = await monter();
  try {
    m.parcours.assurer('A', { pseudo: 'p_A' });
    const { creerNotifsAdmin } = require('../src/admin-notifs');
    const n = creerNotifsAdmin({ db: m.db });
    for (let k = 0; k < 12; k++) n.noterMembre('A', `**Message ${k}**`);
    m.parcours.ajouterRemarque('A', { texte: 'Bien joué', type: 'remarque' });
    const a = { cookie: cookieSession('A', 'p_A') };
    const profil = await (await m.get('/profil', a)).text();
    assert.match(profil, /aria-label="Notifications : 12 non lue\(s\)">[\s\S]*?<span class="compteur">9\+<\/span>/);
    assert.match(profil, /aria-label="Remarques du coach : 1 nouvelle\(s\)">[\s\S]*?<span class="compteur">1<\/span>/);
    assert.match(profil, /class="pf-avatar piece" style="--piece:#5b6cff"/, 'pièce bleue : Elite');
    assert.match(await (await m.get('/notifications', a)).text(), /Message 11[\s\S]*Message 0/);
    await m.get('/remarques', a);
    const apres = await (await m.get('/profil', a)).text();
    assert.doesNotMatch(apres, /class="compteur"/);
  } finally { await m.fermer(); }
});
