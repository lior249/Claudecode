'use strict';

// Tableau des élèves Elite (Kanban) : faire passer un élève d'une étape à l'autre, avec confirmation de ce qui n'a pas
// été validé, compte TikTok donné par l'élève à l'étape 4, jamais GOAT à la main ; ajouter un élève déjà accompagné.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');

const E1 = '700000000000000031';
const attendre = () => new Promise((r) => setTimeout(r, 30));

test('tableau des élèves : colonnes 1 à 4 et GOAT, passer de 1 à 4 avec confirmation, compte TikTok, jamais GOAT, retour en arrière, ajout', async () => {
  const appels = [];
  const bob = { idDepuisPseudo: async (p) => (p === 'kodjo.tt' ? 'K1' : null), parcours: { etapeOuverte: async (...a) => { appels.push(a); } } };
  const m = await monter({ bob });
  try {
    const coach = cookieSession(ADMIN, 'coach');
    // Un membre Elite payé (mobile money) apparaît tout seul, à l'étape 1.
    const { lien } = m.commandes.creerInvitation('test');
    await m.poster(new URL(lien).pathname, { nom: 'Awa Sossou', email: 'awa@example.com' }, { cookie: cookieSession(E1, 'awa_27') });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(m.saspay.derniere().metadata.ref);
    assert.ok(!m.parcours.get(E1), 'pas encore de parcours');
    const page = await (await m.get('/admin/eleves', { cookie: coach })).text();
    assert.match(page, /Élèves Elite/);
    for (const t of ['Prise en main', 'Coaching d\'entrée', 'Validation du contenu', 'Publication et suivi', 'GOAT']) assert.ok(page.includes(t.replace("'", '&#39;')) || page.includes(t), t);
    assert.match(page, /Awa Sossou/);
    assert.strictEqual(m.parcours.get(E1).etape, 1);
    assert.strictEqual((await m.get('/admin/eleves', { cookie: cookieSession(E1, 'awa_27') })).status, 403);

    // Ce qui n'a pas été validé, étape par étape.
    const r = m.parcours.preparerEnvoi(E1, 'L1', { note: 85, retour: 'Retour complet de l\'IA sur la vidéo.' });
    m.db.prepare("UPDATE soumissions SET etat = 'attente', envoye_le = ? WHERE id = ?").run(new Date().toISOString(), r.soumission.id);
    const manque = m.parcours.manquants(E1);
    assert.deepStrictEqual(manque[1], ['Exercice L1 pas validé', 'Exercice L2 pas validé', 'Profil type (L1 ou L2) pas choisi']);
    assert.deepStrictEqual(manque[2], ['Coaching d\'entrée pas fait']);
    assert.deepStrictEqual(manque[3], ['Niche pas encore envoyée', 'Vidéo 1 pas validée', 'Vidéo 2 pas validée', 'Vidéo 3 pas validée']);
    assert.match(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), /Exercice L1/);

    const deplacer = (corps) => fetch(`${m.base}/admin/eleves/${E1}/etape`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: coach }, body: JSON.stringify(corps) });
    // GOAT : jamais à la main. Le compte TikTok n'est jamais exigé du coach : l'élève le donne lui-même à l'étape 4.
    const goat = await deplacer({ etape: 5 });
    assert.strictEqual(goat.status, 400);
    assert.match((await goat.json()).erreur, /GOAT se gagne/);
    assert.strictEqual(m.parcours.get(E1).etape, 1);

    // De 1 à 4 : étapes 1 à 3 passées par le coach, envois en attente laissés de côté, Bob prévient.
    const ok = await deplacer({ etape: 4, compte: 'voyage.douce', niche: 'Voyages', niveau: 'L2' });
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual((await ok.json()).forcees, [1, 2, 3]);
    let p = m.parcours.get(E1);
    assert.strictEqual(p.etape, 4);
    assert.strictEqual(p.compte_tiktok, 'https://www.tiktok.com/@voyage.douce');
    assert.strictEqual(p.niveau, 'L2');
    assert.ok(p.etape1_le && p.etape2_le && p.etape3_le);
    assert.deepStrictEqual(JSON.parse(p.etapes_forcees), [1, 2, 3]);
    assert.strictEqual(m.parcours.soumission(r.soumission.id).etat, 'force');
    assert.doesNotMatch(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), /Exercice L1/, 'plus rien à valider pour lui');
    await attendre();
    assert.deepStrictEqual(appels.map((a) => [a[0].discord_id, a[1]]), [[E1, 4]]);
    assert.match(await (await m.get('/parcours', { cookie: cookieSession(E1, 'awa_27') })).text(), /Choisis tes 3 heures/, 'il commence l\'étape 4');
    const fiche = await (await m.get(`/admin/membres/${E1}`, { cookie: coach })).text();
    assert.match(fiche, /Passée\(s\) par toi : étape\(s\) 1, 2, 3/);
    assert.ok(fiche.includes(`/admin/eleves?eleve=${E1}`), 'Changer d\'étape depuis la fiche');

    // Retour en arrière (correction) : sans message au membre.
    assert.strictEqual((await deplacer({ etape: 2 })).status, 200);
    assert.strictEqual(m.parcours.get(E1).etape, 2);
    await attendre();
    assert.strictEqual(appels.length, 1);

    // GOAT gagné avec les résultats : plus de changement à la main.
    m.db.prepare('UPDATE parcours SET etape = 5 WHERE discord_id = ?').run(E1);
    assert.match((await (await deplacer({ etape: 3 })).json()).erreur, /GOAT/);

    // Ses infos : niche, méthode et pays en texte libre (les Ressources sont cachées), validés d'office.
    const kanban = await (await m.get('/admin/eleves', { cookie: coach })).text();
    assert.match(kanban, /<input id="i-niche" name="niche"[\s\S]*<input id="i-methode" name="methode"[\s\S]*<input id="i-pays" name="pays"/);
    assert.doesNotMatch(kanban, /id="i-niveau"|id="i-entree"/, 'plus de niveau ni de date d\'entrée');
    const infos = (corps) => fetch(`${m.base}/admin/eleves/${E1}/infos`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: coach }, body: JSON.stringify(corps) });
    assert.strictEqual((await infos({ niche: 'Voyages pas chers', methode: 'Carrousel', pays: 'Japon', compte: 'awa.voyage' })).status, 200);
    p = m.parcours.get(E1);
    assert.deepStrictEqual([p.niche, p.methode_texte, p.pays_cible, p.compte_tiktok], ['Voyages pas chers', 'Carrousel', 'Japon', 'https://www.tiktok.com/@awa.voyage']);
    assert.ok(p.positionnement_valide_le, 'écrit par le coach : validé d\'office');

    // Ajouter un élève déjà accompagné, avec sa date d'entrée.
    const inconnu = await m.poster('/admin/eleves/ajouter', { pseudo: 'personne' }, { cookie: coach });
    assert.match(decodeURIComponent(inconnu.headers.get('location')), /n'est pas sur le serveur/);
    const ajout = await m.poster('/admin/eleves/ajouter', { pseudo: '@kodjo.tt', entree: '2026-09-01' }, { cookie: coach });
    assert.match(ajout.headers.get('location'), /fait=ajoute/);
    const k = m.parcours.get('K1');
    assert.strictEqual(k.etape, 1);
    assert.strictEqual(k.entree_le.slice(0, 10), '2026-09-01');
    assert.strictEqual(k.fin_le.slice(0, 10), '2026-11-30');
    assert.match(await (await m.get('/admin/eleves', { cookie: coach })).text(), /kodjo\.tt/);
  } finally { await m.fermer(); }
});

test('compte TikTok : jamais demandé avant l\'étape 4 (réglages, fiche, étape 2)', async () => {
  const m = await monter();
  try {
    m.parcours.assurer('X', { pseudo: 'x' });
    m.db.prepare("UPDATE parcours SET etape = 2 WHERE discord_id = 'X'").run();
    const c = { cookie: cookieSession('X', 'x') };
    for (const url of ['/reglages', '/fiche', '/parcours/etape-2', '/parcours', '/profil']) {
      assert.doesNotMatch(await (await m.get(url, c)).text(), /Lien de (mon|ton|son) (compte|profil)|Mon compte TikTok|name="compte"/, url);
    }
    m.db.prepare("UPDATE parcours SET etape = 4 WHERE discord_id = 'X'").run();
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    assert.match(await (await m.get('/reglages', c)).text(), /Mon compte TikTok/);
    assert.match(await (await m.get('/parcours', c)).text(), /Ajoute le lien de ton compte TikTok/);
  } finally { await m.fermer(); }
});

test('compte TikTok : envoyé par l\'élève, validé par le coach, verrouillé ; changement demandé puis autorisé une fois', async () => {
  const appels = [];
  const m = await monter({ bob: { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) } });
  try {
    m.parcours.assurer('X', { pseudo: 'x' });
    m.db.prepare("UPDATE parcours SET etape = 4 WHERE discord_id = 'X'").run();
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    const eleve = { cookie: cookieSession('X', 'x') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    await m.poster('/parcours/etape-4/compte', { compte: '@premier' }, eleve);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Compte TikTok à valider : https:\/\/www\.tiktok\.com\/@premier/);
    assert.match(await (await m.get('/admin/membres/X', coach)).text(), /id="compte"[\s\S]*Envoyé · à valider[\s\S]*Valider le compte/);
    await m.poster('/admin/membres/X/compte/valider', {}, coach);
    assert.ok(appels.some(([n, , t]) => n === 'messageEleve' && /compte TikTok est validé/.test(t)));
    // Verrouillé : plus de champ, une demande de changement.
    const reglages = await (await m.get('/reglages', eleve)).text();
    assert.match(reglages, /Mon compte TikTok[\s\S]*Validé[\s\S]*Demander un changement de compte/);
    assert.doesNotMatch(reglages, /name="compte"/);
    assert.match((await m.poster('/reglages/tiktok', { compte: '@autre' }, eleve)).headers.get('location'), /erreur=/);
    await m.poster('/reglages/tiktok/demande', { motif: 'Mon compte est shadowban depuis une semaine.' }, eleve);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Demande de changement de compte : Mon compte est shadowban/);
    await m.poster('/admin/membres/X/compte/changement', { decision: 'autoriser' }, coach);
    assert.match(await (await m.get('/reglages', eleve)).text(), /Ton coach autorise le changement/);
    await m.poster('/reglages/tiktok', { compte: '@nouveau' }, eleve);
    const p = m.parcours.get('X');
    assert.deepStrictEqual([p.compte_tiktok, p.compte_valide_le, p.compte_change_autorise], ['https://www.tiktok.com/@nouveau', null, null], 'à revalider, une seule fois');
    assert.match((await m.poster('/reglages/tiktok', { compte: '@encore' }, eleve)).headers.get('location'), /fait=tiktok/, 'pas encore validé : il peut corriger');
  } finally { await m.fermer(); }
});

test('étape 4 : formulaire « Mon compte TikTok » (une question par page) ; méthode et abonnés de départ gardés', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer('X', { pseudo: 'x' }); m.parcours.assurer('Y', { pseudo: 'y' });
    m.db.prepare("UPDATE parcours SET etape = 4 WHERE discord_id IN ('X', 'Y')").run();
    const X = { cookie: cookieSession('X', 'x') };
    const page = await (await m.get('/parcours/etape-4', X)).text();
    assert.match(page, /As-tu déjà un compte TikTok[\s\S]*data-page="n1"[\s\S]*lesn_9J723ZxcGblHC[\s\S]*L'as-tu créé avec la méthode[\s\S]*VPN ou un proxy[\s\S]*Combien d'abonnés[\s\S]*Partage le lien de ton compte/);
    // Compte existant, méthode suivie, 1 250 abonnés.
    await m.poster('/parcours/etape-4/compte', { a_compte: 'oui', methode: 'oui', abonnes: '1250', compte: '@x.histoire' }, X);
    let p = m.parcours.get('X');
    assert.deepStrictEqual([p.compte_tiktok, p.compte_methode, p.compte_abonnes_depart, p.abonnes_actuels], ['https://www.tiktok.com/@x.histoire', 'oui', 1250, 1250]);
    assert.match(await (await m.get('/parcours/etape-4', X)).text(), /En cours d'examen/);
    // Pas de compte : créé avec la méthode, 0 abonné.
    await m.poster('/parcours/etape-4/compte', { a_compte: 'non', methode: 'nouveau', compte: '@y.neuf' }, { cookie: cookieSession('Y', 'y') });
    p = m.parcours.get('Y');
    assert.deepStrictEqual([p.compte_methode, p.compte_abonnes_depart], ['nouveau', 0]);
    assert.match(await (await m.get('/admin/membres/Y', { cookie: cookieSession(ADMIN, 'coach') })).text(), /Nouveau compte, créé avec la méthode · 0 abonnés au départ/);
  } finally { await m.fermer(); }
});
