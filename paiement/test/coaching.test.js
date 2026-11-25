'use strict';

// Livraison 3 : le coaching. Heure locale, disponibilités et imprévus du coach (séances en rouge, coachings en réserve),
// annuler ou reporter, semaine par semaine.

const test = require('node:test');
const assert = require('node:assert');
const { monter, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerCoaching, ajouterJours, lundiDe, dateISO } = require('../src/coaching');
const { creerBob } = require('../src/bob');

const urls = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.url));
const attendre = () => new Promise((r) => setTimeout(r, 30));
const coachingA = (m, horloge) => creerCoaching({ db: m.db, config: m.config, maintenant: horloge });
const FIXES = [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' })); // lundi à jeudi, 15 h 00 UTC

test('coach absent : séances touchées, coaching en réserve (5 au plus), séance rétablie, reprogrammer ou garder', async () => {
  const m = await monter();
  try {
    let now = new Date('2026-11-23T09:00:00Z'); // lundi
    const c = coachingA(m, () => now);
    assert.ok(c.enregistrer('A', FIXES, 240, 'awa').ok);

    // Semaine suivante : absent le mardi à 15 h (séance de A) et le mercredi soir (aucune séance).
    const r = c.enregistrerDisponibilites('2026-11-30', [{ date: '2026-12-01', heure: '15:00' }, { date: '2026-12-02', heure: '21:00' }]);
    assert.strictEqual(r.absences, 2);
    assert.deepStrictEqual(r.touchees.map((t) => [t.discordId, t.date, t.heure, t.credite]), [['A', '2026-12-01', '15:00', true]]);
    assert.strictEqual(c.reserves('A'), 1);
    const mardi = c.occurrences('2026-12-01', '2026-12-01').find((o) => o.discordId === 'A');
    assert.deepStrictEqual(mardi.touchee, { type: 'absence', message: null });
    assert.ok(!c.creneauxLibres(14).some((x) => x.date === '2026-12-02' && x.heure === '21:00'), 'coach absent : pas réservable');
    assert.strictEqual(c.toucheesAChoisir('A').length, 1);
    assert.deepStrictEqual(c.enregistrerDisponibilites('2026-11-30', [{ date: '2026-12-01', heure: '15:00' }, { date: '2026-12-02', heure: '21:00' }]).touchees, [], 'une seule fois');

    // Finalement disponible : séance rétablie, réserve reprise.
    const r2 = c.enregistrerDisponibilites('2026-11-30', []);
    assert.deepStrictEqual(r2.retablies.map((t) => [t.discordId, t.date]), [['A', '2026-12-01']]);
    assert.strictEqual(c.reserves('A'), 0);
    assert.ok(!c.occurrences('2026-12-01', '2026-12-01')[0].touchee);

    // Imprévu le jour même, avec un message : la séance passe en rouge, réserve +1.
    now = new Date('2026-11-24T12:00:00Z'); // mardi
    assert.match(c.signalerImprevu('2026-11-24', ['15:00'], '').erreur, /message/);
    const imp = c.signalerImprevu('2026-11-24', ['15:00'], 'Urgence familiale, désolé !');
    assert.deepStrictEqual(imp.touchees.map((t) => [t.discordId, t.touchee.type, t.touchee.message]), [['A', 'imprevu', 'Urgence familiale, désolé !']]);
    assert.strictEqual(c.reserves('A'), 1);

    // Reprogrammer : la réserve devient une séance sur un créneau libre (en plus de ses séances habituelles).
    const libre = c.creneauxLibres(14).find((x) => x.date === '2026-11-26' && x.heure === '16:00');
    assert.ok(libre);
    const rep = c.choisirTouchee('A', '2026-11-24', '15:00', 'reprogrammer', { date: '2026-11-26', heure: '16:00' });
    assert.ok(rep.ok, JSON.stringify(rep));
    assert.strictEqual(c.reserves('A'), 0);
    assert.ok(c.occurrences('2026-11-26', '2026-11-26').some((o) => o.discordId === 'A' && o.type === 'reserve' && o.heure === '16:00'));
    assert.match(c.choisirTouchee('A', '2026-11-24', '15:00', 'reserve').erreur, /déjà/);
    assert.strictEqual(c.toucheesAChoisir('A').length, 0);

    // Annuler une séance prise sur une réserve rend la réserve.
    assert.ok(c.annuler('A', '2026-11-26', '16:00', 'Finalement je ne peux pas').ok);
    assert.strictEqual(c.reserves('A'), 1);
    assert.strictEqual(c.utiliserReserve('B', '2026-11-27', '16:00').erreur, 'Tu n\'as pas de coaching en réserve.');

    // Au plus 5 coachings en réserve.
    now = new Date('2026-11-23T09:00:00Z');
    c.enregistrerDisponibilites('2026-11-30', ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-07'].map((date) => ({ date, heure: '15:00' })));
    c.enregistrerDisponibilites('2026-12-07', [{ date: '2026-12-07', heure: '15:00' }, { date: '2026-12-08', heure: '15:00' }]);
    assert.strictEqual(c.reserves('A'), 5);
    assert.ok(c.touchees('2026-12-07', '2026-12-13').some((t) => !t.credite), 'au-delà de 5 : pas de réserve de plus');
  } finally { await m.fermer(); }
});

test('annuler ou reporter (30 min avant, justification) ; jour même avant 11 h ; créneau fixe décalé si le coach est absent', async () => {
  const m = await monter();
  try {
    let now = new Date('2026-11-23T09:00:00Z');
    const c = coachingA(m, () => now);
    c.enregistrer('A', FIXES);
    // Report du jeudi 26 au vendredi 27 à 16 h.
    assert.match(c.reporter('A', '2026-11-26', '15:00', 'non', { date: '2026-11-27', heure: '16:00' }).erreur, /pourquoi/);
    assert.match(c.reporter('A', '2026-11-26', '15:00', 'Rendez-vous médical', { date: '2026-11-24', heure: '15:00' }).erreur, /plus libre/, 'sa propre séance');
    const rep = c.reporter('A', '2026-11-26', '15:00', 'Rendez-vous médical', { date: '2026-11-27', heure: '16:00' });
    assert.ok(rep.ok);
    assert.ok(!c.occurrences('2026-11-26', '2026-11-26').some((o) => o.discordId === 'A'));
    assert.strictEqual(c.occurrences('2026-11-27', '2026-11-27')[0].type, 'report');
    // Une autre personne peut prendre le créneau libéré, puis annuler à son tour.
    c.reserverPonctuelle('B', '2026-11-26', '15:00', 'semaine');
    now = new Date('2026-11-26T14:00:00Z');
    assert.ok(c.annuler('B', '2026-11-26', '15:00', 'Imprévu de mon côté').ok);
    now = new Date('2026-11-27T15:40:00Z');
    assert.match(c.reporter('A', '2026-11-27', '16:00', 'Trop tard pour reporter', { date: '2026-11-28', heure: '16:00' }).erreur, /Trop tard/);

    // Le jour même : plus de réservation ponctuelle après 11 h UTC.
    now = new Date('2026-11-28T10:30:00Z');
    assert.ok(c.creneauxLibres(1).some((x) => x.date === '2026-11-28'));
    now = new Date('2026-11-28T11:30:00Z');
    assert.ok(!c.creneauxLibres(1).some((x) => x.date === '2026-11-28'));

    // Créneau fixe réservé pour un jour où le coach est absent : il commence la semaine suivante.
    now = new Date('2026-11-23T09:00:00Z');
    c.enregistrerDisponibilites('2026-11-23', [{ date: '2026-11-27', heure: '21:00' }]);
    const r = c.enregistrer('C', [4, 5, 6].map((jour) => ({ jour, heure: '21:00' })));
    assert.deepStrictEqual(r.decales.map((d) => [d.jour, d.effectifLe]), [[4, '2026-12-04']]);
  } finally { await m.fermer(); }
});

test('semaine par semaine : 3 à 5 séances, une par jour, créneaux libres seulement, pas avec des créneaux fixes', async () => {
  const m = await monter();
  try {
    const now = new Date('2026-11-23T09:00:00Z');
    const c = coachingA(m, () => now);
    c.enregistrer('A', FIXES);
    const lundi = '2026-11-30';
    const s = (jours, heure = '16:00') => jours.map((i) => ({ date: ajouterJours(lundi, i), heure }));
    assert.match(c.reserverSemaine('B', '2026-12-14', s([0, 1, 2])).erreur, /cette semaine ou la semaine prochaine/);
    assert.match(c.reserverSemaine('B', lundi, s([0, 1])).erreur, /au moins 3/);
    assert.match(c.reserverSemaine('B', lundi, [...s([0, 1, 2]), { date: lundi, heure: '21:00' }]).erreur, /seul créneau par jour/);
    assert.match(c.reserverSemaine('B', lundi, s([0, 1, 2], '15:00')).erreur, /plus libre/, 'pris par les créneaux fixes de A');
    assert.ok(!c.aUnPlanning('B'));
    const r = c.reserverSemaine('B', lundi, s([0, 2, 4]));
    assert.ok(r.ok, JSON.stringify(r));
    assert.ok(c.aUnPlanning('B'));
    assert.deepStrictEqual(c.occurrences(lundi, ajouterJours(lundi, 6), { discordId: 'B' }).map((o) => [o.date, o.type]),
      [['2026-11-30', 'semaine'], ['2026-12-02', 'semaine'], ['2026-12-04', 'semaine']]);
    // Modifier sa semaine : remplace les séances à venir.
    assert.ok(c.reserverSemaine('B', lundi, s([1, 2, 3])).ok);
    assert.deepStrictEqual(c.occurrences(lundi, ajouterJours(lundi, 6), { discordId: 'B' }).map((o) => o.date), ['2026-12-01', '2026-12-02', '2026-12-03']);
    const g = c.grilleSemaine('B', lundi);
    assert.strictEqual(g.cases.find((x) => x.date === '2026-12-01' && x.heure === '16:00').etat, 'moi');
    assert.strictEqual(g.cases.find((x) => x.date === '2026-11-30' && x.heure === '15:00').etat, 'pris');
    assert.match(c.reserverSemaine('A', lundi, s([4, 5, 6], '21:00')).erreur, /créneaux fixes/);
    // Passer aux créneaux fixes remplace ses séances « semaine par semaine » à venir.
    assert.ok(c.enregistrer('B', [4, 5, 6].map((jour) => ({ jour, heure: '22:00' }))).ok);
    assert.strictEqual(c.occurrences(lundi, ajouterJours(lundi, 6), { discordId: 'B' }).filter((o) => o.type === 'semaine').length, 0);
  } finally { await m.fermer(); }
});

test('pages : coaching du membre (deux façons de réserver, réserves, séance annulée en rouge), disponibilités et imprévu du coach', async () => {
  const appels = [];
  const bob = { recapCoaching: async () => {}, annulation: async () => {},
    seances: new Proxy({}, { get: (_, nom) => async (...a) => { appels.push([nom, ...a]); } }) };
  const m = await monter({ oauth: fauxOAuth({ E1: [ROLES.elite], E2: [ROLES.elite] }), bob });
  try {
    const e1 = cookieSession('E1', 'awa');
    const coach = cookieSession(ADMIN, 'coach');
    const page = await (await m.get('/coaching', { cookie: e1 })).text();
    assert.match(page, /Créneaux fixes/);
    assert.match(page, /Coachings en réserve/);
    const api = (chemin, cookie, corps) => fetch(`${m.base}${chemin}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(corps) });
    assert.strictEqual((await api('/api/coaching/creneaux', e1, { selection: [0, 1, 2].map((jour) => ({ jour, heure: '22:00' })), fuseau: 'Europe/Paris' })).status, 200);
    assert.strictEqual(m.coaching.profil('E1').fuseau, 'Europe/Paris', 'fuseau du téléphone enregistré');
    assert.strictEqual((await api('/api/coaching/fuseau', e1, { fuseau: 'Pas/Un_Fuseau' })).status, 200);
    assert.strictEqual(m.coaching.profil('E1').fuseau, 'Europe/Paris');
    assert.strictEqual((await api('/api/coaching/rappel', e1, { rappelMin: 120 })).status, 200);
    assert.strictEqual(m.coaching.profil('E1').rappel_min, 120);

    // Semaine par semaine (E2) : la grille de la semaine prochaine, puis la réservation.
    const lundiProchain = ajouterJours(lundiDe(new Date()), 7);
    assert.match(await (await m.get(`/coaching?mode=semaine&semaine=${lundiProchain}`, { cookie: cookieSession('E2', 'kodjo') })).text(), /grille-semaine/);
    const sem = await api('/api/coaching/semaine', cookieSession('E2', 'kodjo'), { lundi: lundiProchain, selection: [0, 1, 2].map((i) => ({ date: ajouterJours(lundiProchain, i), heure: '16:30' })) });
    assert.strictEqual(sem.status, 200, await sem.clone().text());
    assert.ok(appels.some(([nom, id]) => nom === 'semaineReservee' && id === 'E2'));

    // Le coach : disponibilités de la semaine prochaine, absent le mardi soir (séance de E1).
    const dispo = await (await m.get(`/admin/disponibilites?semaine=${lundiProchain}`, { cookie: coach })).text();
    assert.match(dispo, /Mes disponibilités/);
    assert.match(dispo, /awa/, 'les séances des membres sont visibles');
    assert.strictEqual((await m.get('/admin/disponibilites', { cookie: e1 })).status, 403);
    const mardi = ajouterJours(lundiProchain, 1);
    const tout = [];
    for (let i = 0; i < 7; i++) for (const h of m.config.coaching.creneaux) if (!(i === 1 && h === '22:00')) tout.push(`${ajouterJours(lundiProchain, i)}|${h}`);
    const corps = new URLSearchParams([['semaine', lundiProchain], ...tout.map((v) => ['dispo', v])]);
    const r = await fetch(`${m.base}/admin/disponibilites`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: coach }, body: corps });
    assert.match(r.headers.get('location'), /fait=dispo&n=1/);
    const touchees = appels.find(([nom]) => nom === 'touchees')[1];
    assert.deepStrictEqual(touchees.map((t) => [t.discordId, t.date, t.heure]), [['E1', mardi, '22:00']]);
    assert.match(await (await m.get(`/admin?semaine=${lundiProchain}&fait=dispo&n=1`, { cookie: coach })).text(), /choix du membre en attente/);

    // Le membre voit sa séance en rouge, avec sa réserve, et choisit de la garder.
    const rouge = await (await m.get('/coaching', { cookie: e1 })).text();
    assert.match(rouge, /Séance annulée par ton coach/);
    assert.match(rouge, /Coach absent/);
    assert.strictEqual((await api('/api/coaching/touchee', e1, { date: mardi, heure: '22:00', choix: 'reserve' })).status, 200);
    assert.doesNotMatch(await (await m.get('/coaching', { cookie: e1 })).text(), /Séance annulée par ton coach/);
    assert.strictEqual(m.coaching.reserves('E1'), 1);

    // Utiliser la réserve sur un créneau libre ; le coach est prévenu.
    const libre = m.coaching.creneauxLibres(14)[3];
    assert.strictEqual((await api('/api/coaching/reserve', e1, { date: libre.date, heure: libre.heure })).status, 200);
    assert.ok(appels.some(([nom, id, s]) => nom === 'reserveUtilisee' && id === 'E1' && s.date === libre.date));

    // Imprévu : la page du jour, puis le message aux membres.
    assert.match(await (await m.get(`/admin/imprevu?date=${lundiProchain}`, { cookie: coach })).text(), /J'ai un imprévu/);
    const imp = await m.poster('/admin/imprevu', { date: lundiProchain, heure: '22:00', message: 'Coupure de courant, désolé.' }, { cookie: coach });
    assert.match(imp.headers.get('location'), /fait=imprevu&n=1/);
    assert.strictEqual((await m.poster('/admin/imprevu', { date: lundiProchain, heure: '22:00', message: '' }, { cookie: coach })).status, 400);
    assert.match(await (await m.get(`/admin?semaine=${lundiProchain}`, { cookie: coach })).text(), /Calendrier des coachings/);
  } finally { await m.fermer(); }
});

test('Bob : demande des disponibilités le dimanche, messages des séances annulées à l\'heure du membre, pas de rappel pour elles', async () => {
  let now = new Date('2026-11-29T07:59:00Z'); // dimanche
  const m = await monter({ maintenant: () => now });
  try {
    const dms = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
    await bob.demanderDisponibilites();
    assert.strictEqual(dms.length, 0, 'avant 8 h');
    now = new Date('2026-11-29T08:00:00Z');
    await bob.demanderDisponibilites(); await bob.demanderDisponibilites();
    assert.strictEqual(dms.length, 1);
    assert.match(dms[0][1], /disponibilités de la semaine du 30\/11/);
    assert.ok(urls(dms[0][2])[0].includes('retour=%2Fadmin%2Fdisponibilites%3Fsemaine%3D2026-11-30'));

    // Séance de A (fuseau de Paris) le mardi 1er décembre à 15 h UTC : coach absent.
    now = new Date('2026-11-29T09:00:00Z');
    m.coaching.enregistrer('A', FIXES, 240, 'awa');
    m.coaching.majFuseau('A', 'Europe/Paris');
    const r = m.coaching.enregistrerDisponibilites('2026-11-30', [{ date: '2026-12-01', heure: '15:00' }]);
    await bob.seances.touchees(r.touchees);
    const msg = dms.filter(([id]) => id === 'A').map(([, t]) => t)[0];
    assert.match(msg, /Ton coach sera absent le mardi 1 décembre à 16:00/);
    assert.match(msg, /1 coaching en réserve/);

    // Le jour venu : rappels pour les autres séances, pas pour celle-là.
    now = new Date('2026-12-01T12:30:00Z');
    await bob.rappelsCoaching();
    assert.ok(!dms.some(([id, t]) => id === 'A' && /Rappel/.test(t)), 'séance annulée : pas de rappel');
    now = new Date('2026-12-02T12:30:00Z');
    await bob.rappelsCoaching();
    assert.ok(dms.some(([id, t]) => id === 'A' && /Rappel : ta séance de coaching privé est \*\*mercredi 2 décembre à 16:00\*\*/.test(t)));
  } finally { await m.fermer(); }
});
