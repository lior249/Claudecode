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

test('création par délais : attente 1 à 14 jours, durée 1 à 30 jours ou indéfinie, un palier par stat, 1 à 3 gagnants, au plus 5 à la fois', async () => {
  const m = await monter();
  try {
    const ev = creerEvenements({ db: m.db });
    const d = { ...base, attenteJours: 7, dureeJours: 14, paliers: { revenus: 1000 }, gagnants: 1 };
    assert.match(ev.creer({ ...d, attenteJours: 0 }).erreur, /de 1 à 14 jours/);
    assert.match(ev.creer({ ...d, attenteJours: 15 }).erreur, /de 1 à 14 jours/);
    assert.match(ev.creer({ ...d, dureeJours: 31 }).erreur, /de 1 à 30 jours, ou indéfinie/);
    assert.match(ev.creer({ ...d, paliers: {} }).erreur, /palier à atteindre pour chaque stat/);
    assert.match(ev.creer({ ...d, stats: [] }).erreur, /au moins une stat/);
    // Brouillon : pas de date ; mis en ligne : les dates partent d'aujourd'hui.
    const br = ev.creer({ ...d, reglesPoints: '' }).evenement;
    assert.strictEqual(br.statut, 'brouillon'); assert.strictEqual(br.debut, '');
    assert.strictEqual(br.regles_points, 'Le premier à atteindre $1,000 depuis le début du challenge gagne le badge.');
    const p = ev.publier(br.id).evenement;
    assert.strictEqual(p.debut, j(7)); assert.strictEqual(p.fin, j(20));
    assert.strictEqual(ev.etat(p), 'a_venir');
    const ind = ev.creer({ ...d, indefinie: true, heure: '18:30', enLigne: true }).evenement;
    assert.strictEqual(ind.fin, ev.SANS_FIN); assert.strictEqual(ind.heure, '18:30'); assert.strictEqual(ind.statut, 'publie');
    for (let k = 0; k < 3; k++) assert.ok(ev.creer({ ...d, enLigne: true }).evenement);
    const trop = ev.creer({ ...d, enLigne: true });
    assert.match(trop.erreur, /déjà 5 événements/); assert.ok(trop.brouillonGarde, 'gardé en brouillon');
    assert.ok(ev.estGlobal({ stats: ['revenus', 'vues', 'abonnes'] }));
  } finally { await m.fermer(); }
});

test('course : les premiers à atteindre le palier gagnent tout de suite (or, argent) ; fin quand tous les gagnants sont arrivés', async () => {
  const m = await monter();
  try {
    let now = new Date();
    const ev = creerEvenements({ db: m.db, maintenant: () => now });
    const e = ev.creer({ ...base, attenteJours: 1, indefinie: true, paliers: { revenus: 100 }, gagnants: 2, enLigne: true }).evenement;
    for (const id of [E1, E2, '700000000000000063']) m.db.prepare('INSERT INTO inscriptions_evenement (evenement_id, discord_id, inscrit_le) VALUES (?, ?, ?)').run(e.id, id, now.toISOString());
    const vals = { [E1]: 50, [E2]: 0, '700000000000000063': 0 };
    const valeurDe = (x, id) => ({ revenus: vals[id] });
    assert.deepStrictEqual(ev.cloturer(valeurDe), [], 'pas encore commencé');
    now = new Date(Date.now() + 2 * 864e5);
    assert.deepStrictEqual(ev.cloturer(valeurDe), []);
    vals[E2] = 120;
    assert.deepStrictEqual(ev.cloturer(valeurDe).map((x) => [x.discordId, x.rang]), [[E2, 1]], 'E2 arrive premier : or tout de suite');
    assert.strictEqual(ev.etat(ev.un(e.id)), 'en_cours');
    now = new Date(now.getTime() + 60000);
    vals[E1] = 300; vals['700000000000000063'] = 150;
    assert.deepStrictEqual(ev.cloturer(valeurDe).map((x) => [x.discordId, x.rang]), [[E1, 2]], 'arrivés ensemble : le plus haut prend l\'argent');
    assert.strictEqual(ev.etat(ev.un(e.id)), 'termine', '2 gagnants : la course est finie');
    assert.deepStrictEqual(ev.cloturer(valeurDe), []);
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
    assert.doesNotMatch(cl, /class="cl-evts"/, 'plus de cartes d\'événements : la bannière suffit');
    assert.match(cl, /class="evts"[\s\S]*Overmaxx 1000[\s\S]*Revenus générés sur Overmaxx[\s\S]*Classement all-time[\s\S]*Classement événement/);
    assert.doesNotMatch(await (await m.get('/coaching', awa)).text(), /class="evts"/, 'la bannière : seulement sur le profil et le classement');
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
    assert.match(form, /1\. L.{1,6}événement[\s\S]*2\. Les délais[\s\S]*name="attente_jours"[\s\S]*name="duree_indefinie"[\s\S]*3\. La course[\s\S]*name="palier_revenus"[\s\S]*name="gagnants"[\s\S]*Conditions de participation[\s\S]*name="cond_banger"[\s\S]*4\. La récompense[\s\S]*value="brouillon"[^>]*>Mettre en brouillon[\s\S]*value="publier"[^>]*>Mettre en ligne/);
    for (let k = 1; k <= 4; k++) {
      const r = await m.poster('/admin/evenements', { titre: `Défi ${k}`, description: 'x', stats: ['vues'], palier_vues: '100000', attente_jours: '5', duree_jours: '10', gagnants: '1', action: 'brouillon' }, coach);
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
    assert.match(page, /Brouillon[\s\S]*Pour gagner[\s\S]*commencera 5 jour\(s\) après la mise en ligne[\s\S]*Mettre en ligne[\s\S]*Supprimer le brouillon/);
    assert.strictEqual((await m.poster(`/admin/evenements/${e.id}/publier`, {}, coach)).headers.get('location'), '/admin/evenements?fait=publie');
    const pub = m.db.prepare('SELECT * FROM evenements WHERE id = ?').get(e.id);
    assert.strictEqual(pub.statut, 'publie'); assert.strictEqual(pub.debut, j(5)); assert.strictEqual(pub.fin, j(14));
    // La carte du challenge (bannière) : le badge à débloquer, la description, « Participer ».
    const cl = await (await m.get('/classement', coach)).text();
    assert.match(cl, /<dialog class="fenetre evc ev-scene-dlg"[\s\S]*class="ev-scene-rayons"[\s\S]*Défi 1[\s\S]*Badge à débloquer[\s\S]*href="\/evenements\/\d+\?participer=1"[^>]*>Participer/);
    assert.match(cl, /data-carte="evc-0"/);
    assert.match(await (await m.get('/classement', coach)).text(), /Défi 1/);
    await m.poster('/admin/evenements/2/supprimer', {}, coach);
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM evenements').get().n, 3);
  } finally { await m.fermer(); }
});

test('notifications : publication (éligible ou ce qu\'il manque), devenu éligible, rappels 10 j / 5 j / 3 j / 24 h avant la fin des inscriptions', async () => {
  const appels = [];
  const m = await monter({ bob: { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) } });
  try {
    for (const [id, ps] of [[E1, 'awa_27'], [E2, 'bilal']]) { m.parcours.assurer(id, { pseudo: ps }); m.parcours.changerEtape(id, 4); }
    m.db.prepare("INSERT INTO trophees (discord_id, cle, obtenu_le) VALUES (?, 'revenus_rookie', ?)").run(E1, new Date().toISOString());
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    await m.poster('/admin/evenements', { titre: 'Flash 1K', description: 'x', stats: ['revenus'], palier_revenus: '1000', attente_jours: '12', duree_jours: '10', gagnants: '1', action: 'publier', cond_revenus: 'revenus_rookie' }, coach);
    const msgs = (id) => appels.filter(([n, p]) => n === 'messageEleve' && p.discord_id === id).map((x) => x[2]);
    await (await m.get('/classement', { cookie: cookieSession(E1, 'awa_27') })).text();
    // la vérification de chaque minute
    await m.notifierEvenements();
    assert.match(msgs(E1)[0], /Nouvel événement : Flash 1K[\s\S]*Tu es éligible/);
    assert.match(msgs(E2)[0], /Nouvel événement : Flash 1K[\s\S]*il te faut : Rookie/);
    await m.notifierEvenements();
    assert.strictEqual(msgs(E1).length, 1, 'une seule fois'); assert.strictEqual(msgs(E2).length, 1);
    // Bilal devient éligible.
    m.db.prepare("INSERT INTO trophees (discord_id, cle, obtenu_le) VALUES (?, 'revenus_amateur', ?)").run(E2, new Date().toISOString());
    await m.notifierEvenements();
    assert.match(msgs(E2)[1], /Tu es maintenant éligible au challenge Flash 1K/);
    // 10 jours avant la fin des inscriptions : rappel aux éligibles non inscrits.
    m.db.prepare('UPDATE evenements SET debut = ? WHERE id = 1').run(j(9));
    await m.notifierEvenements();
    assert.match(msgs(E1)[1], /plus que \*\*10 jours\*\* pour t'inscrire/);
    await m.poster('/evenements/1/inscrire', {}, { cookie: cookieSession(E1, 'awa_27') });
    m.db.prepare('UPDATE evenements SET debut = ? WHERE id = 1').run(j(1));
    await m.notifierEvenements();
    assert.strictEqual(msgs(E1).length, 2, 'inscrit : plus de rappel');
    assert.match(msgs(E2).pop(), /plus que \*\*24 heures\*\*/);
  } finally { await m.fermer(); }
});

test('modifier un challenge : brouillon, ou en ligne jusqu\'à la clôture des inscriptions ; « ? » sur les trophées du formulaire', async () => {
  const m = await monter();
  try {
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const form = await (await m.get('/admin/evenements/nouveau', coach)).text();
    assert.match(form, /class="ev-info"[^>]*data-info="Rookie : [^"]+"/, 'un « ? » avec ce que demande le trophée');
    await m.poster('/admin/evenements', { titre: 'Flash 1K', description: 'x', stats: ['revenus'], palier_revenus: '1000', attente_jours: '5', duree_jours: '10', gagnants: '1', action: 'publier', cond_revenus: 'revenus_pro' }, coach);
    const liste = await (await m.get('/admin/evenements', coach)).text();
    assert.match(liste, /href="\/admin\/evenements\/1\/modifier"[^>]*>Modifier/);
    const page = await (await m.get('/admin/evenements/1/modifier', coach)).text();
    assert.match(page, /Modifier le challenge[\s\S]*value="Flash 1K"[\s\S]*name="palier_revenus"[^>]*value="1000"[\s\S]*value="revenus_pro"[^>]*checked[\s\S]*Enregistrer les modifications/);
    const r = await m.poster('/admin/evenements/1/modifier', { titre: 'Flash 1K', description: 'Nouvelle description', stats: ['revenus'], palier_revenus: '1000', duree_jours: '20', gagnants: '1', action: 'enregistrer', cond_revenus: 'revenus_rookie' }, coach);
    assert.strictEqual(r.headers.get('location'), '/admin/evenements?fait=modifie');
    const e = m.db.prepare('SELECT * FROM evenements WHERE id = 1').get();
    assert.strictEqual(e.description, 'Nouvelle description'); assert.strictEqual(JSON.parse(e.conditions).revenus, 'revenus_rookie');
    assert.strictEqual(e.debut, j(5), 'le début ne bouge pas'); assert.strictEqual(e.fin, j(24), 'la fin suit la nouvelle durée');
    // Inscriptions closes : plus modifiable.
    m.db.prepare('UPDATE evenements SET debut = ? WHERE id = 1').run(j(-1));
    assert.match((await m.get('/admin/evenements/1/modifier', coach)).headers.get('location'), /erreur=.*inscriptions%20sont%20closes/);
    assert.match((await m.poster('/admin/evenements/1/modifier', { titre: 'x', description: 'y', stats: ['revenus'], palier_revenus: '5', action: 'enregistrer' }, coach)).headers.get('location'), /erreur=/);
  } finally { await m.fermer(); }
});
