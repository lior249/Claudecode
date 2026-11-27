'use strict';

// Trophées (résultats validés), fenêtre « Garde ce qui marche » (signaux banger), objectifs, Trophy room.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');

const E1 = '700000000000000031';
const E2 = '700000000000000032';
const jour = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

function video(m, id, { vues, abonnes = null, rpm = null, revenus = null, valide = true }) {
  return Number(m.db.prepare(`INSERT INTO publications (discord_id, jour, lien, cree_le, res_vues, res_abonnes, res_rpm, res_revenus, res_etat, ok_vues, ok_revenus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, jour, `https://www.tiktok.com/@a/video/${Math.random()}`, now, vues, abonnes, rpm, revenus,
    valide ? 'valide' : 'attente', valide ? vues : null, valide ? revenus : null).lastInsertRowid);
}
const update = (m, id, { vues, revenus = null, abonnes }) => m.db.prepare("INSERT INTO comptes_rendus (discord_id, jour, etat, vues_28j, revenus_28j, abonnes, cree_le) VALUES (?, ?, 'valide', ?, ?, ?, ?)")
  .run(id, jour, vues, revenus, abonnes, now);

test('trophées : gagnés sur les résultats validés, fenêtre une seule fois, salle des trophées, profil et classement', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    // Rien encore.
    assert.deepStrictEqual((await (await m.get('/api/celebrations', membre)).json()).trophees, []);
    // Une vidéo à 120K vues validée, 1 200 abonnés, 150 000 vues au total, $120 gagnés.
    video(m, E1, { vues: 120000, abonnes: 900, revenus: 120 });
    update(m, E1, { vues: 150000, revenus: 120, abonnes: 1200 });
    const c = await (await m.get('/api/celebrations', membre)).json();
    assert.deepStrictEqual(c.trophees.map((t) => t.cle).sort(),
      ['abonnes_junior', 'banger_argent', 'banger_bronze', 'compte_bronze', 'revenus_amateur', 'revenus_rookie']);
    assert.match(c.trophees.find((t) => t.cle === 'abonnes_junior').label, /Tu viens d'obtenir 1 000 abonnés/);
    assert.match(c.trophees[0].piece, /<img[^>]*src="\/static\/trophees\/[a-z0-9-]+\.png"/);
    // Vus : ils ne reviennent pas.
    await fetch(`${m.base}/api/celebrations/vu`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre.cookie }, body: JSON.stringify({ trophees: c.trophees.map((t) => t.cle), banger: true }) });
    assert.deepStrictEqual((await (await m.get('/api/celebrations', membre)).json()).trophees, []);
    // La salle des trophées.
    const salle = await (await m.get('/trophees', membre)).text();
    assert.match(salle, /Mes trophées[\s\S]*6 \/ 22/);
    assert.match(salle, /Banger Argent[\s\S]*Obtenu le/);
    assert.match(salle, /Sophomore[\s\S]*Objectif : 5 000 abonnés/);
    assert.match(salle, /Régularité Bronze[\s\S]*Objectif : 10 jours d.{1,6}affilée/);
    assert.match(salle, /GOAT[\s\S]*Objectif : 1 000 \$ sur 28 jours/);
    // Profil : identité à gauche, Trophy room à droite ; prochain objectif = 5 000 abonnés (10K et 100K vues, 1K abonnés atteints).
    const profil = await (await m.get('/profil', membre)).text();
    assert.match(profil, /class="pf-identite"><div class="qui">[\s\S]*class="pf-salle"[\s\S]*Trophy room <small>6 \/ 22/);
    assert.match(profil, /Prochain objectif<\/span><b>5 000 abonnés/);
    // Classement : le dernier trophée à côté du nom.
    assert.match(await (await m.get('/classement', membre)).text(), /class="tr-cl"/);
    // Régularité : 10 updates envoyées d'affilée.
    for (let k = 1; k <= 10; k++) m.db.prepare("INSERT INTO comptes_rendus (discord_id, jour, etat, envoye_le, cree_le) VALUES (?, ?, 'attente', ?, ?)")
      .run(E1, new Date(Date.now() - (k + 1) * 864e5).toISOString().slice(0, 10), now, now);
    assert.ok((await (await m.get('/api/celebrations', membre)).json()).trophees.some((x) => x.cle === 'regularite_bronze'));
    // Après une décision du coach, Bob prévient l'élève des nouveaux trophées.
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const id = video(m, E1, { vues: 1200000, revenus: 10, valide: false });
    m.db.prepare("UPDATE publications SET res_captures = '[]', res_envoye_le = ? WHERE id = ?").run(now, id);
    await m.poster(`/admin/resultats/${id}/decision`, { decision: 'valider' }, coach);
    const t = appels.find(([n]) => n === 'trophees');
    assert.ok(t, 'Bob prévient des trophées');
    assert.deepStrictEqual(t[2].map((x) => x.cle), ['banger_or']);
  } finally { await m.fermer(); }
});

test('« Garde ce qui marche » : chaque signal une seule fois, avec ses raisons ; « Ne plus afficher » coupe tout', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer(E2, { pseudo: 'bilal' });
    m.parcours.changerEtape(E2, 4);
    const membre = { cookie: cookieSession(E2, 'bilal') };
    // Résultats donnés par l'élève (pas encore validés) : 15K vues, 900 abonnés (6 %).
    video(m, E2, { vues: 15000, abonnes: 900, valide: false });
    const c = await (await m.get('/api/celebrations', membre)).json();
    assert.strictEqual(c.trophees.length, 0, 'les trophées attendent la validation');
    assert.ok(c.banger);
    assert.strictEqual(c.banger.raisons.length, 2);
    assert.match(c.banger.raisons.join(' '), /15 000 vues en 24 h[\s\S]*900 abonnés \(6 % des vues\)/);
    assert.match(c.banger.lecon, /whop\.com/);
    const vu = (corps) => fetch(`${m.base}/api/celebrations/vu`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre.cookie }, body: JSON.stringify(corps) });
    await vu({ banger: true });
    // Une autre vidéo à 20K vues : le signal « vues » a déjà été montré.
    video(m, E2, { vues: 20000, valide: false });
    assert.strictEqual((await (await m.get('/api/celebrations', membre)).json()).banger, null);
    // Un nouveau signal (RPM ≥ 1 $) : la fenêtre revient avec cette seule raison.
    video(m, E2, { vues: 3000, rpm: 1.4, valide: false });
    const r = (await (await m.get('/api/celebrations', membre)).json()).banger;
    assert.deepStrictEqual(r.raisons, ['Son RPM est de 1,4 $.']);
    // Ne plus afficher : plus rien, même pour un nouveau signal.
    await vu({ bangersOff: true });
    video(m, E2, { vues: 3000, revenus: 80, valide: false });
    assert.strictEqual((await (await m.get('/api/celebrations', membre)).json()).banger, null);
    assert.ok(m.parcours.get(E2).bangers_off);
    // Le script de la fenêtre est sur les pages de l'élève, avec le message dissuasif.
    const page = await (await m.get('/profil', membre)).text();
    assert.match(page, /conçue pour être regardée encore et encore[\s\S]*\/api\/celebrations/);
  } finally { await m.fermer(); }
});

test('profil vu depuis le classement : comme Mon profil, sans étape ni objectifs ; ses trophées sont visibles', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    for (const [id, pseudo] of [[E1, 'awa_27'], [E2, 'bilal']]) { m.parcours.assurer(id, { pseudo }); m.parcours.changerEtape(id, 4); }
    video(m, E2, { vues: 15000, revenus: 60 });
    update(m, E2, { vues: 40000, revenus: 60, abonnes: 600 });
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const page = await (await m.get(`/classement/${E2}`, membre)).text();
    assert.match(page, /class="pf-identite"[\s\S]*Trophy room <small>2 \/ 22[\s\S]*class="dernier"><b>(Rookie|Banger Bronze)<\/b>/);
    // Sans trophée : « Aucun », rien d'autre.
    // Sans trophée : le titre et le compteur restent à leur place ; un tiret à la place des pièces et du nom.
    assert.match(await (await m.get('/profil', membre)).text(), /<h3>Trophy room <small>0 \/ 22<\/small><\/h3>\s*<div class="pieces"><span class="absent"[^>]*>N\/A<\/span><\/div><div class="dernier"><b>–<\/b><\/div>/);
    assert.match(page, /href="\/trophees\?de=700000000000000032"/);
    assert.match(page, /Revenus[\s\S]*Rang[\s\S]*Jours/);
    assert.doesNotMatch(page, /Prochain objectif|Étape 4|sur 90/);
    const salle = await (await m.get(`/trophees?de=${E2}`, membre)).text();
    assert.match(salle, /Trophées de bilal[\s\S]*Banger Bronze[\s\S]*Obtenu le/);
    // Le détail d'un trophée : comment l'obtenir, leçons conseillées, combien et qui l'ont.
    assert.match(salle, /data-ouvrir-trophee="banger_bronze"/);
    assert.match(salle, /<template data-detail="banger_bronze">[\s\S]*Pour l.{1,6}obtenir[\s\S]*Leçons conseillées[\s\S]*Améliorer ton hook[\s\S]*Seuls <b>50 %<\/b>|<template data-detail="banger_bronze">[\s\S]*Plus de <b>50 %<\/b>/);
    assert.match(salle, /<template data-detail="banger_bronze">[\s\S]*href="\/classement\/700000000000000032"/);
    assert.match(salle, /<template data-detail="banger_platine">[\s\S]*Personne ne l.{1,6}a encore/);
  } finally { await m.fermer(); }
});
