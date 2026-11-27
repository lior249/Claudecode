'use strict';

// Événements (challenges) : dates, conditions de trophée, inscription, classement de l'événement.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { creerEvenements } = require('../src/evenements');

const E1 = '700000000000000061';
const E2 = '700000000000000062';
const j = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test('création : début dans 3 à 15 jours, durée 3 à 30 jours, au plus 5 à la fois', async () => {
  const m = await monter();
  try {
    const ev = creerEvenements({ db: m.db });
    const base = { titre: 'Overmaxx 1000', description: 'Le premier à $1 000.' };
    assert.match(ev.creer({ ...base, debut: j(2), fin: j(10) }).erreur, /au plus tôt dans 3 jours/);
    assert.match(ev.creer({ ...base, debut: j(16), fin: j(20) }).erreur, /au plus tard dans 15 jours/);
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(4) }).erreur, /au moins 3 jours/);
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(33) }).erreur, /au plus 30 jours/);
    for (let k = 0; k < 5; k++) assert.ok(ev.creer({ ...base, debut: j(3), fin: j(32) }).evenement, 'durée de 30 jours acceptée');
    assert.match(ev.creer({ ...base, debut: j(3), fin: j(10) }).erreur, /déjà 5 événements/);
  } finally { await m.fermer(); }
});

test('conditions de trophée, inscription, page de l\'événement, bannière, classement all-time / événement', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    for (const [id, ps] of [[E1, 'awa_27'], [E2, 'bilal']]) { m.parcours.assurer(id, { pseudo: ps }); m.parcours.changerEtape(id, 4); }
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    // Le coach crée l'événement : il faut le trophée Rookie ($50) ou mieux.
    const r = await m.poster('/admin/evenements', { titre: 'Overmaxx 1000', objectif: 'Le premier à $1 000', description: 'Challenge de lancement.', debut: j(3), fin: j(20), cond_revenus: 'revenus_rookie' }, coach);
    assert.strictEqual(r.headers.get('location'), '/admin/evenements?fait=1');
    const e = m.db.prepare('SELECT * FROM evenements').get();
    // Awa a $120 (Rookie et Amateur) ; Bilal n'a rien.
    m.db.prepare("INSERT INTO trophees (discord_id, cle, obtenu_le) VALUES (?, 'revenus_amateur', ?)").run(E1, new Date().toISOString());
    const awa = { cookie: cookieSession(E1, 'awa_27') }; const bilal = { cookie: cookieSession(E2, 'bilal') };
    const page = await (await m.get(`/evenements/${e.id}`, awa)).text();
    assert.match(page, /Overmaxx 1000[\s\S]*À venir[\s\S]*Pour participer[\s\S]*Rookie[\s\S]*Je participe/);
    assert.match(await (await m.get(`/evenements/${e.id}`, bilal)).text(), /Il te manque un trophée/);
    assert.match((await m.poster(`/evenements/${e.id}/inscrire`, {}, bilal)).headers.get('location'), /erreur=/);
    await m.poster(`/evenements/${e.id}/inscrire`, {}, awa);
    assert.match(await (await m.get(`/evenements/${e.id}`, awa)).text(), /Tu es inscrit[\s\S]*Classement de l.{1,6}événement[\s\S]*Awa|Tu es inscrit[\s\S]*awa_27/);
    // La bannière défile en haut des pages ; le classement montre l'événement en haut, et l'onglet événement.
    const cl = await (await m.get('/classement', awa)).text();
    assert.match(cl, /class="cl-evts"[\s\S]*Overmaxx 1000[\s\S]*Revenus générés sur Overmaxx[\s\S]*Classement all-time[\s\S]*Classement événement/);
    assert.match(cl, /href="\/evenements\/\d+"/);
    assert.match(await (await m.get('/classement?vue=evenement', awa)).text(), /<h2>Overmaxx 1000<\/h2>[\s\S]*class="ev-rang"/);
  } finally { await m.fermer(); }
});
