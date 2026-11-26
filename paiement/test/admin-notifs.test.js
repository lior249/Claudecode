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
    assert.strictEqual(bob.notifsAdmin.nonLues(), 3, 'ouvrir la page ne marque rien comme lu');
    const id = bob.notifsAdmin.nonLuesListe()[0].id;
    await m.get(`/admin/notifications/${id}/ouvrir`, admin);
    assert.strictEqual(bob.notifsAdmin.nonLues(), 2, 'seule celle ouverte devient lue');
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
    assert.match(profil, /aria-label="Remarques : 1 nouveau\(x\)">[\s\S]*?compteur-bb">1</, 'barre du bas : remarques');
    assert.match(profil, /aria-label="Mes rappels : 12 nouveau\(x\)">[\s\S]*?compteur-bb">9\+</, 'barre du bas : rappels');
    assert.match(profil, /var n = 13;[\s\S]*setAppBadge\(n\)/, 'nombre sur l\'icône de l\'application');
    assert.match(await (await m.get('/notifications', a)).text(), /Message 11[\s\S]*Message 0/);
    await m.get('/remarques', a);
    const apres = await (await m.get('/profil', a)).text();
    assert.doesNotMatch(apres, /class="compteur"/);
  } finally { await m.fermer(); }
});

test('notification test : envoyée à un seul compte par son pseudo, rangée dans ses notifications', async () => {
  const envois = [];
  const m = await monter({ bob: {
    idDepuisPseudo: async (p) => (p === 'nofloh24' ? 'T1' : null),
    notifier: { membre: async (id, c) => { envois.push([id, c]); return true; } },
    boutonsLien: () => [], lienPerso: () => 'http://x',
  } });
  try {
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const r = await m.poster('/admin/notifications/test', { pseudo: '@nofloh24' }, coach);
    assert.match(decodeURIComponent(r.headers.get('location')), /test=Notification test envoyée à @nofloh24/);
    assert.deepStrictEqual(envois.map(([id]) => id), ['T1']);
    assert.match(envois[0][1].content, /Notification test d'Overmaxx/);
    assert.match(decodeURIComponent((await m.poster('/admin/notifications/test', { pseudo: 'inconnu' }, coach)).headers.get('location')), /pas sur le serveur/);
    assert.match(await (await m.get(r.headers.get('location'), coach)).text(), /Notification test envoyée à @nofloh24/);
  } finally { await m.fermer(); }
});

test('coach : Envoyer un message (destinataires, accusés 👎 👍 👁️, relance, modification), profil coach, vue liste', async () => {
  const envois = []; const modifs = [];
  // A reçoit (👍), B non (👎).
  const bob = { parcours: { message: async (e, p, o = {}) => { envois.push([e.titre, p.discord_id, Boolean(o.relance)]); return p.discord_id !== 'B'; },
    remarqueModifiee: async (p) => { modifs.push(p.discord_id); } } };
  const m = await monter({ bob });
  const attendre = () => new Promise((x) => setTimeout(x, 20));
  try {
    for (const id of ['A', 'B', 'C']) m.parcours.assurer(id, { pseudo: `p_${id}` });
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const eleveA = { cookie: cookieSession('A', 'p_A') };
    const page = await (await m.get('/admin/planifier?onglet=message&a=B', coach)).text();
    assert.match(page, /aria-current="page">Envoyer un message/);
    assert.match(page, /Sélectionner les destinataires[\s\S]*Rechercher un élève[\s\S]*Tout sélectionner[\s\S]*value="A"[\s\S]*value="B" checked/);
    assert.match(page, /data-marque="\*\*"[\s\S]*data-marque="\*"[\s\S]*data-marque="__"/, 'gras, italique, souligné');
    assert.match((await m.poster('/admin/planifier/message', { titre: 'x', texte: 'y' }, coach)).headers.get('location'), /erreur=.*destinataire/);
    const r = await m.poster('/admin/planifier/message', { titre: 'Pense à ton update', texte: 'Ce soir **avant 21 h**.', ids: ['A', 'B'] }, coach);
    assert.strictEqual(r.headers.get('location'), '/admin/planifier?onglet=message&fait=message&n=2');
    await attendre();
    assert.deepStrictEqual(envois, [['Pense à ton update', 'A', false], ['Pense à ton update', 'B', false]]);
    const remA = await (await m.get('/remarques', eleveA)).text(); // A le lit
    assert.match(remA, /<b class="titre-msg">Pense à ton update<\/b>[\s\S]*Ce soir <b>avant 21 h<\/b>/);
    await attendre();
    const envoye = await (await m.get('/admin/planifier?onglet=message', coach)).text();
    assert.match(envoye, /Messages envoyés[\s\S]*Pense à ton update/);
    assert.match(envoye, /👎 1<\/summary>[\s\S]*p_B[\s\S]*👍 0<\/summary>[\s\S]*👁️ 1<\/summary>[\s\S]*p_A/);
    assert.match(envoye, /Relancer ceux qui ne l'ont pas lu \(1\)/);
    const id = m.db.prepare('SELECT id FROM envois_messages').get().id;
    await m.poster(`/admin/messages/${id}/relancer`, {}, coach);
    await attendre();
    assert.deepStrictEqual(envois.pop(), ['Pense à ton update', 'B', true], 'relance : seulement ceux qui ne l\'ont pas lu');
    // Modifier : jamais supprimer ; A l'avait lu → prévenu, et sa bulle se rallume.
    assert.strictEqual((await m.poster(`/admin/messages/${id}`, { titre: 'Pense à ton update', texte: 'Ce soir avant 22 h.' }, coach)).headers.get('location'), '/admin/planifier?onglet=message&fait=modifie');
    assert.deepStrictEqual(modifs, ['A']);
    assert.match(await (await m.get('/profil', eleveA)).text(), /Remarques : 1 nouveau/);
    assert.match(await (await m.get('/remarques', eleveA)).text(), /avant 22 h/);
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM remarques').get().n, 2, 'une remarque par élève, rien de supprimé');
    assert.doesNotMatch(await (await m.get('/profil', eleveA)).text(), /class="evenements/, 'un message ne va pas dans la bannière');
    assert.match(await (await m.get('/coach', coach)).text(), /Coach Overmaxx[\s\S]*Élèves[\s\S]*Tâches du jour[\s\S]*Coachings du jour/);
    const liste = await (await m.get('/admin/eleves?vue=liste', coach)).text();
    assert.match(liste, /class="bouton secondaire ls-ouvrir"[^>]*>Filtres[\s\S]*class="ls-panneau" hidden[\s\S]*data-tri="revenus"[\s\S]*↓ Décroissant[\s\S]*↑ Croissant[\s\S]*Appliquer[\s\S]*class="ls-ligne"/);
    assert.doesNotMatch(await (await m.get('/admin/eleves', coach)).text(), /déjà accompagné/, 'plus de formulaire d\'ajout');
  } finally { await m.fermer(); }
});

test('élève → coach : message direct, rangé dans À traiter avec les notifications ; le coach répond', async () => {
  const recus = []; const envois = [];
  const m = await monter({ bob: { parcours: { messageAuCoach: async (x, p) => { recus.push([x.texte, p.discord_id]); }, message: async (e, p) => { envois.push([e.titre, p.discord_id]); return true; } } } });
  const attendre = () => new Promise((x) => setTimeout(x, 20));
  try {
    m.parcours.assurer('A', { pseudo: 'p_A' });
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const eleve = { cookie: cookieSession('A', 'p_A') };
    assert.match(await (await m.get('/remarques', eleve)).text(), /Écrire au coach/);
    assert.strictEqual((await m.poster('/remarques/ecrire', { texte: 'Comment garder mes viewers ?' }, eleve)).headers.get('location'), '/remarques?fait=envoye');
    await attendre();
    assert.deepStrictEqual(recus, [['Comment garder mes viewers ?', 'A']]);
    m.db.prepare("INSERT INTO notifications_admin (texte, lien, cree_le) VALUES ('Nouvelle candidature de x', '/admin/candidatures/1', ?)").run(new Date().toISOString());
    const traiter = await (await m.get('/admin/a-traiter', coach)).text();
    assert.match(traiter, /data-filtre="messages"[\s\S]*data-filtre="notifications"/);
    assert.match(traiter, /Comment garder mes viewers \?[\s\S]*href="\/admin\/messages-recus\/1"/);
    assert.match(traiter, /Nouvelle candidature de x[\s\S]*href="\/admin\/notifications\/\d+\/ouvrir"/);
    const nid = m.db.prepare('SELECT id FROM notifications_admin').get().id;
    assert.strictEqual((await m.get(`/admin/notifications/${nid}/ouvrir`, coach)).headers.get('location'), '/admin/candidatures/1');
    assert.ok(m.db.prepare('SELECT lu_le FROM notifications_admin WHERE id = ?').get(nid).lu_le, 'ouverte : lue');
    assert.strictEqual((await m.get('/admin/messages-recus/1', eleve)).status, 403);
    assert.match(await (await m.get('/admin/messages-recus/1', coach)).text(), /Comment garder mes viewers[\s\S]*Répondre/);
    await m.poster('/admin/messages-recus/1/repondre', { titre: 'Ta question', texte: 'Coupe les 2 premières secondes.' }, coach);
    await attendre();
    assert.deepStrictEqual(envois, [['Ta question', 'A']]);
    const apres = await (await m.get('/admin/a-traiter', coach)).text();
    assert.match(apres, /Déjà traité[\s\S]*class="tr-carte fait" data-cat="messages"[\s\S]*Comment garder mes viewers/, 'répondu : en noir, dans « Déjà traité »');
    assert.doesNotMatch(apres.split('Déjà traité')[0], /Comment garder mes viewers/);
    assert.match(traiter, /class="tr-carte a-traiter" data-cat="messages"/, 'à traiter : fond orange');
    assert.match(await (await m.get('/remarques', eleve)).text(), /Coupe les 2 premières secondes[\s\S]*|répondu/);
  } finally { await m.fermer(); }
});

test('remarques compactes : 3 bien visibles, les suivantes en fondu, « Tout afficher »', async () => {
  const m = await monter();
  try {
    m.parcours.assurer('A', { pseudo: 'p_A' });
    for (let k = 1; k <= 6; k++) m.parcours.ajouterRemarque('A', { texte: `Remarque numéro ${k}` });
    const page = await (await m.get('/remarques', { cookie: cookieSession('A', 'p_A') })).text();
    assert.match(page, /class="remarques-liste repliee"/);
    assert.strictEqual((page.match(/class="remarque compacte"/g) || []).length, 6);
    assert.match(page, /Tout afficher \(6\)/);
    const fiche = await (await m.get('/admin/membres/A', { cookie: cookieSession(ADMIN, 'coach') })).text();
    assert.match(fiche, /Remarques du coach[\s\S]*Tout afficher \(6\)[\s\S]*Statistiques/, 'statistiques juste sous les remarques');
  } finally { await m.fermer(); }
});
