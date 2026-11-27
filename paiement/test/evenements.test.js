'use strict';

// Événements (challenges) : dates, stats suivies, conditions de trophée, inscription en 3 étapes, classements par stat
// (tout le monde part de 0), badges spéciaux au podium, Trophy room, rappels du challenge global.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { creerEvenements } = require('../src/evenements');

const E1 = '700000000000000061';
const E2 = '700000000000000062';
const j = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const base = { titre: 'Overmaxx 1000', description: 'Le premier à $1 000.', stats: ['revenus'], reglesPoints: 'Celui qui génère le plus gagne.' };

test('création : début dans 3 à 15 jours, durée 3 à 30 jours, au moins une stat, au plus 5 à la fois', async () => {
  const m = await monter();
  try {
    const ev = creerEvenements({ db: m.db });
    assert.match(ev.creer({ ...base, debut: j(2), fin: j(10) }).erreur, /au plus tôt dans 3 jours/);
    assert.match(ev.creer({ ...base, debut: j(16), fin: j(20) }).erreur, /au plus tard dans 15 jours/);
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(4) }).erreur, /au moins 3 jours/);
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(33) }).erreur, /au plus 30 jours/);
    assert.match(ev.creer({ ...base, stats: [], debut: j(3), fin: j(10) }).erreur, /au moins une stat/);
    assert.match(ev.creer({ ...base, reglesPoints: '', debut: j(3), fin: j(10) }).erreur, /comment on gagne/);
    for (let k = 0; k < 5; k++) assert.ok(ev.creer({ ...base, debut: j(3), fin: j(32) }).evenement, 'durée de 30 jours acceptée');
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(10) }).erreur, /déjà 5 événements/);
    assert.ok(ev.estGlobal({ stats: ['revenus', 'vues', 'abonnes'] }));
    assert.ok(!ev.estGlobal({ stats: ['revenus'] }));
  } finally { await m.fermer(); }
});

test('inscription en 3 étapes (présentation, trophées, règles), classements par stat, bannière, onglets du classement', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    for (const [id, ps] of [[E1, 'awa_27'], [E2, 'bilal']]) { m.parcours.assurer(id, { pseudo: ps }); m.parcours.changerEtape(id, 4); }
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const r = await m.poster('/admin/evenements', { titre: 'Overmaxx 1000', objectif: 'Le premier à $1 000', description: 'Challenge de lancement.', debut: j(3), fin: j(20),
      cond_revenus: 'revenus_rookie', stats: ['revenus', 'vues', 'abonnes'], regles_points: 'Le plus d\'argent, de vues ou d\'abonnés.', regles_validation: 'Capture à chaque update.', badge_nom: 'Overmaxx 1000' }, coach);
    assert.strictEqual(r.headers.get('location'), '/admin/evenements?fait=publie', 'avec des dates : publié directement');
    const e = m.db.prepare('SELECT * FROM evenements').get();
    m.db.prepare("INSERT INTO trophees (discord_id, cle, obtenu_le) VALUES (?, 'revenus_amateur', ?)").run(E1, new Date().toISOString());
    const awa = { cookie: cookieSession(E1, 'awa_27') }; const bilal = { cookie: cookieSession(E2, 'bilal') };
    const page = await (await m.get(`/evenements/${e.id}`, awa)).text();
    assert.match(page, /Rejoindre le challenge[\s\S]*J.{1,6}ai lu, j.{1,6}ai compris[\s\S]*il te faut ces trophées[\s\S]*border-color:#3b82f6[\s\S]*data-aller="3"[\s\S]*Pour gagner[\s\S]*Je participe/);
    const pb = await (await m.get(`/evenements/${e.id}`, bilal)).text();
    assert.match(pb, /disabled[^>]*>Continuer[\s\S]*Tu n.{1,6}as pas les prédispositions nécessaires/);
    assert.match((await m.poster(`/evenements/${e.id}/inscrire`, {}, bilal)).headers.get('location'), /erreur=/);
    await m.poster(`/evenements/${e.id}/inscrire`, {}, awa);
    const apres = await (await m.get(`/evenements/${e.id}`, awa)).text();
    assert.match(apres, /Tu participes à ce challenge[\s\S]*Pour gagner[\s\S]*Validation des résultats[\s\S]*Argent généré[\s\S]*Vues[\s\S]*Abonnés gagnés/);
    assert.doesNotMatch(apres, /Rejoindre le challenge/);
    const cl = await (await m.get('/classement', awa)).text();
    assert.match(cl, /class="cl-evts"[\s\S]*Overmaxx 1000[\s\S]*Revenus générés sur Overmaxx[\s\S]*Classement all-time[\s\S]*Classement événement/);
    assert.match(await (await m.get('/classement?vue=evenement', awa)).text(), /<h2>Overmaxx 1000<\/h2>[\s\S]*Argent généré[\s\S]*class="ev-rang"/);
  } finally { await m.fermer(); }
});

test('fin d\'événement : tout le monde part de 0 ; le podium de chaque stat reçoit le badge spécial ; Trophy room et Badges spéciaux', async () => {
  const appels = [];
  const m = await monter({ bob: { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) } });
  try {
    for (const [id, ps] of [[E1, 'awa_27'], [E2, 'bilal']]) { m.parcours.assurer(id, { pseudo: ps }); m.parcours.changerEtape(id, 4); }
    // Un événement déjà fini (créé à la main dans la base pour le test).
    m.db.exec(`CREATE TABLE IF NOT EXISTS evenements (id INTEGER PRIMARY KEY)`);
    creerEvenements({ db: m.db });
    m.db.prepare(`INSERT INTO evenements (titre, description, debut, fin, conditions, cree_le, stats, regles_points, badge_nom) VALUES ('Overmaxx 1000', 'x', ?, ?, '{}', ?, '["revenus"]', 'x', 'Overmaxx 1000')`)
      .run(j(-10), j(-1), new Date().toISOString());
    for (const id of [E1, E2]) m.db.prepare('INSERT INTO inscriptions_evenement (evenement_id, discord_id, inscrit_le) VALUES (1, ?, ?)').run(id, new Date().toISOString());
    // Awa : $100 avant l'événement, puis $280 → $180 pendant ; Bilal : $50 pendant.
    const cr = m.db.prepare("INSERT INTO comptes_rendus (discord_id, jour, etat, vues_28j, revenus_28j, abonnes, cree_le) VALUES (?, ?, 'valide', ?, ?, ?, ?)");
    cr.run(E1, j(-12), 1000, 100, 100, new Date().toISOString());
    cr.run(E1, j(-3), 5000, 280, 400, new Date().toISOString());
    cr.run(E2, j(-8), 100, 0, 10, new Date().toISOString());
    cr.run(E2, j(-2), 900, 50, 60, new Date().toISOString());
    assert.deepStrictEqual(m.suivi.entre(E1, j(-10), j(-1)), { revenus: 180, vues: 4000, abonnes: 300 });
    const awa = { cookie: cookieSession(E1, 'awa_27') };
    await m.get('/evenements/1', awa); // clôture
    const badges = m.db.prepare('SELECT discord_id, rang FROM badges_evenement ORDER BY rang').all();
    assert.deepStrictEqual(badges.map((b) => [b.discord_id, b.rang]), [[E1, 1], [E2, 2]]);
    assert.ok(appels.some(([n, , t]) => n === 'messageEleve' && /1er du challenge Overmaxx 1000/.test(t)));
    // La fenêtre de victoire, puis la Trophy room (barre, puis le badge spécial) et la section « Badges spéciaux ».
    const c = await (await m.get('/api/celebrations', awa)).json();
    assert.ok(c.trophees.some((t) => t.cle.startsWith('badge:') && /1er du challenge/.test(t.label)));
    assert.match(await (await m.get('/profil', awa)).text(), /class="sep-badge"/);
    assert.match(await (await m.get('/trophees', awa)).text(), /Badges spéciaux[\s\S]*Overmaxx 1000[\s\S]*1er · Argent généré/);
    assert.doesNotMatch(await (await m.get('/trophees', { cookie: cookieSession('700000000000000099', 'x') })).text(), /Badges spéciaux/);
  } finally { await m.fermer(); }
});

test('formulaire d\'événement : détourage des badges dans le navigateur (planche de 3 ou une image par badge)', async () => {
  const m = await monter();
  try {
    const page = await (await m.get('/admin/evenements/nouveau', { cookie: cookieSession(ADMIN, 'coach') })).text();
    assert.match(page, /data-planche[\s\S]*data-apercu="or"[\s\S]*name="badge_or"[\s\S]*data-slot="argent"[\s\S]*name="badge_bronze"/);
  } finally { await m.fermer(); }
});

test('coach : bouton « Créer un événement », brouillon sans dates, publication avec les dates, les 3 derniers puis « Voir tous »', async () => {
  const m = await monter();
  try {
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const liste0 = await (await m.get('/admin/evenements', coach)).text();
    assert.match(liste0, /href="\/admin\/evenements\/nouveau"[^>]*>\+ Créer un événement/);
    assert.doesNotMatch(liste0, /name="titre"/, 'le formulaire n\'est pas ouvert d\'office');
    const form = await (await m.get('/admin/evenements/nouveau', coach)).text();
    assert.match(form, /1\. L.{1,6}événement[\s\S]*2\. Les règles[\s\S]*Ce qui est suivi[\s\S]*Conditions de participation[\s\S]*name="cond_banger"[\s\S]*3\. La récompense[\s\S]*Enregistrer en brouillon/);
    for (let k = 1; k <= 4; k++) {
      const r = await m.poster('/admin/evenements', { titre: `Défi ${k}`, description: 'x', stats: ['vues'], regles_points: 'Le plus de vues.' }, coach);
      assert.strictEqual(r.headers.get('location'), '/admin/evenements?fait=brouillon');
    }
    const e = m.db.prepare("SELECT * FROM evenements WHERE titre = 'Défi 1'").get();
    assert.strictEqual(e.statut, 'brouillon');
    const liste = await (await m.get('/admin/evenements', coach)).text();
    assert.strictEqual((liste.match(/class="ev-ligne"/g) || []).length, 3);
    assert.match(liste, /Voir tous les événements \(4\)/);
    assert.strictEqual((((await (await m.get('/admin/evenements?tous=1', coach)).text()).match(/class="ev-ligne"/g)) || []).length, 4);
    // Le brouillon n'est visible par personne d'autre (pas de bannière), puis publié avec les dates.
    assert.doesNotMatch(await (await m.get('/classement', coach)).text(), /Défi 1/);
    const page = await (await m.get(`/admin/evenements/${e.id}`, coach)).text();
    assert.match(page, /Brouillon[\s\S]*Pour gagner[\s\S]*Publier l.{1,6}événement[\s\S]*Supprimer le brouillon/);
    assert.match((await m.poster(`/admin/evenements/${e.id}/publier`, { debut: j(1), fin: j(5) }, coach)).headers.get('location'), /erreur=/);
    assert.strictEqual((await m.poster(`/admin/evenements/${e.id}/publier`, { debut: j(4), fin: j(10) }, coach)).headers.get('location'), '/admin/evenements?fait=publie');
    assert.strictEqual(m.db.prepare('SELECT statut FROM evenements WHERE id = ?').get(e.id).statut, 'publie');
    assert.match(await (await m.get('/classement', coach)).text(), /Défi 1/);
    await m.poster('/admin/evenements/2/supprimer', {}, coach);
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM evenements').get().n, 3);
  } finally { await m.fermer(); }
});
