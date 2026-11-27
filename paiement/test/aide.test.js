'use strict';

// « Demander de l'aide » : la demande guidée arrive chez le coach (À traiter, Bob) avec le résumé des 3 points.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { composer, etatAxes } = require('../src/aide');

const E1 = '700000000000000041';

test('composer : le résumé pour le coach, et les champs obligatoires', () => {
  const axes = etatAxes({ tutos_vus: '["hook"]' }, [{ axe: 'hook', etat: 'valide', envoye_le: '2026-01-01' }]);
  assert.deepStrictEqual(axes.map((a) => [a.cle, a.vu, a.video && a.video.libelle]), [['hook', true, 'prête à publier'], ['engagement', false, null], ['watchtime', false, null]]);
  assert.match(composer({ categorie: 'x', texte: 'Bonjour coach' }).erreur, /Choisis/);
  assert.match(composer({ categorie: 'vues', texte: 'court' }).erreur, /Explique/);
  const c = composer({ categorie: 'vues', axe: 'hook', video: 'https://www.tiktok.com/@a/video/1', texte: 'Je plafonne à 300 vues.' }, axes);
  assert.strictEqual(c.sujet, 'Demande d\'aide · Vues');
  assert.match(c.texte, /Problème : Mes vidéos ne font pas assez de vues\nCe qui bloque, selon lui : Le hook\nVidéo : https:\/\/www\.tiktok\.com\/@a\/video\/1\nLeçons regardées : Hook ✓ · Engagement ✗ · Watchtime ✗\nVidéos relues : Hook \(prête à publier\) · Engagement — · Watchtime —\n\nJe plafonne à 300 vues\./);
  // Un problème technique : pas de résumé des 3 points.
  assert.doesNotMatch(composer({ categorie: 'technique', texte: 'Bob ne m\'envoie plus rien.' }, axes).texte, /Leçons/);
});

test('/aide : assistant, envoi au coach, À traiter, réponse', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const page = await (await m.get('/aide', membre)).text();
    assert.match(page, /Qu.{1,6}est-ce qui se passe[\s\S]*data-valeur="categorie=vues"[\s\S]*Les 3 points|Qu.{1,6}est-ce qui se passe[\s\S]*data-valeur="categorie=vues"/);
    assert.match(page, /D.{1,6}abord, les 3 points[\s\S]*Leçon pas regardée/);
    assert.match(page, /href="\/aide"[\s\S]*Demander de l.{1,6}aide/, 'dans le menu');
    // Erreur : pas de catégorie.
    const r0 = await m.poster('/aide', { texte: 'Mes vidéos plafonnent.' }, membre);
    assert.match(r0.headers.get('location'), /erreur=/);
    const r = await m.poster('/aide', { categorie: 'vues', axe: 'watchtime', video: '', texte: 'Mes vidéos plafonnent à 200 vues.' }, membre);
    assert.strictEqual(r.headers.get('location'), '/aide?fait=1');
    assert.match(await (await m.get('/aide?fait=1', membre)).text(), /Ton coach a reçu ta demande/);
    const msg = m.db.prepare('SELECT * FROM messages_coach WHERE discord_id = ?').get(E1);
    assert.strictEqual(msg.sujet, 'Demande d\'aide · Vues');
    assert.match(msg.texte, /Ce qui bloque, selon lui : Le watchtime/);
    assert.ok(appels.some(([n]) => n === 'messageAuCoach'), 'Bob prévient le coach');
    // Le coach : dans À traiter, puis la page du message.
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Demande d.{1,6}aide · Vues/);
    assert.match(await (await m.get(`/admin/messages-recus/${msg.id}`, coach)).text(), /Leçons regardées : Hook ✗/);
    // L'élève voit sa demande dans « Mes dernières demandes ».
    assert.match(await (await m.get('/aide', membre)).text(), /Mes dernières demandes[\s\S]*Vues/);
    // Le lien depuis la section Progresser de l'étape 4.
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Bloqué \? Demander de l.{1,6}aide/);
  } finally { await m.fermer(); }
});

test('rappels du coach : la notification ouvre la page concernée', () => {
  const { creerNotifsAdmin, pageDevinee } = require('../src/admin-notifs');
  assert.strictEqual(pageDevinee('Vérifier les coachings du jour'), '/admin?vue=jour');
  assert.strictEqual(pageDevinee('Donner mes disponibilités'), '/admin/disponibilites');
  assert.strictEqual(pageDevinee('Valider les comptes rendus'), '/admin/a-traiter');
  const { ouvrirBase } = require('../src/db');
  const db = ouvrirBase(':memory:');
  const n = creerNotifsAdmin({ db, maintenant: () => new Date('2026-12-01T08:00:00Z') });
  n.creer({ texte: 'Vérifier les coachings du jour', frequence: 'jour', heure: '08:00' });
  n.creer({ texte: 'Autre chose', frequence: 'jour', heure: '08:00', page: '/admin/eleves' });
  const [a, b] = n.rappels();
  assert.strictEqual(n.pageDuRappel(a), '/admin?vue=jour&date=2026-12-01');
  assert.strictEqual(n.pageDuRappel(b), '/admin/eleves');
});

test('élève passé à l\'étape 4 par le coach : niche, compte, heures et coachings demandés dans l\'ordre (pas L1, L2 ni les vidéos tests)', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    m.db.prepare('INSERT INTO profils_membres (discord_id, maj_le, accueil_fini_le) VALUES (?, ?, ?)').run(E1, new Date().toISOString(), new Date().toISOString());
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const profil = await (await m.get('/profil', membre)).text();
    assert.match(profil, /Envoie ta niche[\s\S]*Ajoute ton compte TikTok[\s\S]*Choisis tes 3 heures[\s\S]*Réserve tes coachings de la semaine/);
    assert.doesNotMatch(profil, /exercices L1 et L2|Envoie tes 3 vidéos/);
    // Sa fiche : un bouton pour envoyer sa niche, un pour son compte.
    const fiche = await (await m.get('/fiche', membre)).text();
    assert.match(fiche, /href="\/parcours\/etape-3#strategie"[^>]*>Envoyer ma niche/);
    assert.match(fiche, /href="\/parcours\/etape-4#compte"[^>]*>Ajouter mon compte TikTok/);
    // L'étape 3 reste ouverte pour la niche.
    assert.match(await (await m.get('/parcours/etape-3', membre)).text(), /Ma niche[\s\S]*As-tu déjà choisi ta niche/);
  } finally { await m.fermer(); }
});

test('profil du coach : carrousel À la une / Classement, programme des coachings (semaine, mois, jour) et fiche d\'une séance', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const demain = m.coaching.ajouterJours(m.coaching.dateISO(new Date()), 1);
    assert.ok(m.coaching.reserverPonctuelle(E1, demain, m.config.coaching.creneaux[0], 'entree').ok);
    m.parcours.ajouterRemarque(E1, { texte: 'Travaille ton hook.', type: 'remarque' });
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    // L'élève : son coaching approche → « Un problème ? Dis-le à ton coach ».
    assert.match(await (await m.get('/profil', membre)).text(), /Ton coaching approche : un problème/);
    await m.poster('/aide', { categorie: 'vues', axe: 'hook', texte: 'Je bloque à 200 vues depuis 5 jours.' }, membre);
    assert.doesNotMatch(await (await m.get('/profil', membre)).text(), /Ton coaching approche : un problème/);
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const semaine = await (await m.get('/coach', coach)).text();
    assert.match(semaine, /class="pf-identite"[\s\S]*class="qui"[\s\S]*pf-carrousel[\s\S]*À la une[\s\S]*Classement/);
    if (m.coaching.lundiDe(new Date()) === m.coaching.lundiDe(new Date(`${demain}T12:00:00Z`))) {
      assert.match(semaine, /class="pg-semaine"[\s\S]*data-e="reserve" data-seance=/);
    }
    const jour = await (await m.get(`/coach?vue=jour&date=${demain}`, coach)).text();
    assert.match(jour, /class="pg-jour"[\s\S]*awa_27/);
    assert.match(jour, /<template data-fiche="[^"]+">[\s\S]*Niveau[\s\S]*Étape 4[\s\S]*Dernière remarque[\s\S]*Travaille ton hook[\s\S]*Ses questions et demandes récentes[\s\S]*Demande d.{1,6}aide · Vues[\s\S]*Je bloque à 200 vues/);
    assert.match(await (await m.get('/coach?vue=mois', coach)).text(), /class="pg-mois"/);
  } finally { await m.fermer(); }
});

test('« mon coach me livre un compte » : demande, attente, livraison par le coach (validée d\'office), élève prévenu', async () => {
  const appels = [];
  const m = await monter({ bob: { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    m.db.prepare("UPDATE parcours SET niche = 'X', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE discord_id = ?").run(E1);
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Mon coach me livre un compte prêt[\s\S]*formaction="\/parcours\/etape-4\/livraison"/);
    await m.poster('/parcours/etape-4/livraison', { note_livraison: 'Pays visé : France' }, membre);
    assert.ok(appels.some(([n, , t]) => n === 'activiteEleve' && /compte TikTok livré par toi/.test(t)));
    const e4 = await (await m.get('/parcours/etape-4', membre)).text();
    assert.match(e4, /En préparation[\s\S]*Pays visé : France[\s\S]*Finalement, j.{1,6}ai mon propre compte/);
    assert.doesNotMatch(await (await m.get('/profil', membre)).text(), /Ajoute ton compte TikTok/);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Demande un compte TikTok livré par toi : Pays visé : France/);
    const fiche = await (await m.get(`/admin/membres/${E1}`, coach)).text();
    assert.match(fiche, /Demande un compte livré par toi[\s\S]*compte\/livrer[\s\S]*Ne mets jamais de mot de passe ici/);
    await m.poster(`/admin/membres/${E1}/compte/livrer`, { compte: 'https://www.tiktok.com/@awa.livre', message: 'Identifiants envoyés en privé sur Discord.' }, coach);
    const p = m.parcours.get(E1);
    assert.strictEqual(p.compte_tiktok, 'https://www.tiktok.com/@awa.livre');
    assert.ok(p.compte_valide_le, 'validé d\'office');
    assert.strictEqual(p.compte_methode, 'livre');
    assert.strictEqual(p.compte_livraison_le, null);
    assert.ok(appels.some(([n, , t]) => n === 'messageEleve' && /Ton compte TikTok est prêt[\s\S]*awa\.livre[\s\S]*Identifiants envoyés/.test(t)));
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Choisis tes 3 heures/);
  } finally { await m.fermer(); }
});
