'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { monter, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerSynchroWhop } = require('../src/synchro-whop');
const { creerCoaching } = require('../src/coaching');
const { creerBob } = require('../src/bob');
const { creerCommandes } = require('../src/commandes');

const JOUR = 86400000;
const ref = (s) => s.metadata.ref;

async function inscrire(m, email, { programme = 'community', discordId } = {}) {
  if (programme === 'community') await m.poster('/community/paiement', { nom: `Nom ${email}`, email });
  else await m.poster(new URL(m.commandes.creerInvitation().lien).pathname, { nom: `Nom ${email}`, email });
  m.saspay.payer(m.saspay.derniere().id);
  await m.etat(ref(m.saspay.derniere()));
  const mb = m.db.prepare('SELECT * FROM membres WHERE email = ? AND programme = ?').get(email, programme);
  if (discordId) m.db.prepare('UPDATE membres SET discord_id = ? WHERE id = ?').run(discordId, mb.id);
  return m.db.prepare('SELECT * FROM membres WHERE id = ?').get(mb.id);
}

// ---------- Liste d'attente Whop ----------

test('Whop : accepte la demande dont l\'email correspond, refuse les inconnues après 48 h, prolonge au renouvellement', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'awa@example.com');
    const notifs = [];
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config, notifier: { admin: async (t) => notifs.push(t) } });
    m.whop.ajouterDemande('e1', 'awa@example.com');
    m.whop.ajouterDemande('e2', 'inconnu@example.com', 'plan_com', 49 * 3600 * 1000);
    m.whop.ajouterDemande('e3', 'recent@example.com', 'plan_com', 3600 * 1000);
    await synchro.executer();
    assert.deepStrictEqual(m.whop.appels.slice(0, 2), [['accepter', 'e1'], ['refuser', 'e2']]);
    assert.strictEqual(m.whop.demandes.get('e3').status, 'pending', 'récente : on attend encore');
    assert.match(notifs[0], /inconnu@example\.com/);
    let mb = m.db.prepare('SELECT * FROM membres').get();
    assert.strictEqual(mb.whop_membership_id, 'mem_e1');
    assert.strictEqual(mb.whop_jours_a_ajouter, 0);

    // Une 2e demande avec le même email n'est pas acceptée (accès déjà ouvert).
    m.whop.ajouterDemande('e4', 'awa@example.com');
    await synchro.executer();
    assert.ok(!m.whop.appels.some((a) => a[1] === 'e4'));

    // Renouvellement payé : Whop prolongé de 30 jours.
    await m.poster('/community/renouveler', { nom: 'Awa', email: 'awa@example.com', m: require('../src/liens').jetonMembre('awa@example.com', m.config.secretApp) });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    await synchro.executer();
    assert.deepStrictEqual(m.whop.appels.at(-1), ['prolonger', 'mem_e1', 30]);
    mb = m.db.prepare('SELECT * FROM membres').get();
    assert.strictEqual(mb.whop_jours_a_ajouter, 0);
  } finally { await m.fermer(); }
});

test('Whop : un membre qui renouvelle avant de rejoindre Whop reçoit les jours en plus', async () => {
  const m = await monter();
  try {
    const mb = await inscrire(m, 'awa@example.com');
    m.db.prepare('UPDATE membres SET acces_jusqu_au = ? WHERE id = ?').run(new Date(Date.now() + 60 * JOUR).toISOString(), mb.id);
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config });
    m.whop.ajouterDemande('e1', 'awa@example.com');
    await synchro.executer();
    assert.deepStrictEqual(m.whop.appels.at(-1), ['prolonger', 'mem_e1', 30]);
  } finally { await m.fermer(); }
});

// ---------- Coaching ----------

function coachingA(m, iso) {
  return creerCoaching({ db: m.db, config: m.config, maintenant: () => new Date(iso) });
}
const SEMAINE = [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' }));

test('coaching : minimum 4, un par jour, créneau déjà pris, limite de 11h00 GMT', async () => {
  const m = await monter();
  try {
    const lundi10h = coachingA(m, '2026-11-23T10:59:00.000Z'); // lundi
    assert.match(lundi10h.enregistrer('A', SEMAINE.slice(0, 3)).erreur, /au moins 4/);
    assert.match(lundi10h.enregistrer('A', [...SEMAINE, { jour: 0, heure: '21:00' }]).erreur, /seul créneau par jour/);
    const r = lundi10h.enregistrer('A', SEMAINE);
    assert.ok(r.ok);
    assert.deepStrictEqual(r.decales, [], 'réservé avant 11h : le lundi compte aujourd\'hui');
    assert.strictEqual(m.db.prepare("SELECT effectif_le e FROM reservations WHERE jour = 0").get().e, '2026-11-23');

    const lundi11h = coachingA(m, '2026-11-23T11:00:00.000Z');
    assert.match(lundi11h.enregistrer('B', SEMAINE).erreur, /vient d'être pris/);
    const r2 = lundi11h.enregistrer('B', [0, 1, 2, 3].map((jour) => ({ jour, heure: '21:00' })));
    assert.deepStrictEqual(r2.decales.map((d) => [d.jour, d.effectifLe]), [[0, '2026-11-30']], '21h réservé à 11h00 : semaine suivante');
    assert.strictEqual(lundi11h.grille('B').cases.find((c) => c.jour === 0 && c.heure === '15:00').etat, 'pris');
    assert.strictEqual(lundi11h.grille('A').cases.find((c) => c.jour === 0 && c.heure === '15:00').etat, 'moi');

    // Les séances de B lundi soir ne comptent pas cette semaine.
    const occ = lundi11h.occurrences('2026-11-23', '2026-11-23');
    assert.deepStrictEqual(occ.map((o) => `${o.discordId} ${o.heure}`), ['A 15:00']);
  } finally { await m.fermer(); }
});

test('coaching : annulation avec justification, au plus tard 30 min avant', async () => {
  const m = await monter();
  try {
    coachingA(m, '2026-11-23T09:00:00.000Z').enregistrer('A', SEMAINE);
    const c = coachingA(m, '2026-11-23T14:00:00.000Z');
    assert.match(c.annuler('A', '2026-11-23', '15:00', '').erreur, /pourquoi/);
    assert.ok(c.annuler('A', '2026-11-23', '15:00', 'Empêchement familial').ok);
    assert.deepStrictEqual(c.occurrences('2026-11-23', '2026-11-23'), []);
    const tard = coachingA(m, '2026-11-24T14:45:00.000Z');
    assert.match(tard.annuler('A', '2026-11-24', '15:00', 'Trop tard ici').erreur, /Trop tard/);
  } finally { await m.fermer(); }
});

test('pages coaching et admin : connexion, Elite seulement, GOAT exclu, admin', async () => {
  const oauth = fauxOAuth({ E1: [ROLES.elite], G1: [ROLES.elite, ROLES.goat], C1: [ROLES.community] });
  const recaps = [];
  const m = await monter({ oauth, bob: { recapCoaching: async (...a) => recaps.push(a), annulation: async () => {} } });
  try {
    assert.match(await (await m.get('/coaching')).text(), /Se connecter avec Discord/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('G1') })).text(), /GOAT/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('C1') })).text(), /réservé aux membres Elite/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('E1') })).text(), /Mes créneaux de coaching/);

    const poster = (cookie, body) => fetch(`${m.base}/api/coaching/creneaux`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
    assert.strictEqual((await poster(cookieSession('G1'), { selection: SEMAINE })).status, 403);
    const ok = await poster(cookieSession('E1'), { selection: SEMAINE, rappelMin: 180 });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(recaps[0][0], 'E1');

    assert.match(await (await m.get('/admin')).text(), /Espace admin/);
    assert.strictEqual((await m.get('/admin', { cookie: cookieSession('E1') })).status, 403);
    const admin = await (await m.get('/admin', { cookie: cookieSession(ADMIN) })).text();
    assert.match(admin, /Calendrier des coachings/);
    assert.match(admin, /data-cle=/);
  } finally { await m.fermer(); }
});

// ---------- Bob ----------

function fauxDiscord() {
  const dms = [];
  const membres = new Map();
  const kicks = [];
  const roleCache = (ids) => {
    const set = new Set(ids);
    return { has: (r) => set.has(r), set };
  };
  return {
    dms, kicks, membres,
    ajouter(id, roles = []) {
      const cache = roleCache(roles);
      membres.set(id, {
        roles: { cache, add: async (r) => cache.set.add(r), remove: async (r) => cache.set.delete(r) },
        kick: async () => { kicks.push(id); membres.delete(id); },
      });
    },
    client: {
      isReady: () => true,
      users: { fetch: async (id) => ({ send: async (c) => dms.push([id, typeof c === 'string' ? c : c.content, c.components]) }) },
    },
    serveur: { members: { fetch: async (id) => { if (!membres.has(id)) throw new Error('absent'); return membres.get(id); } } },
  };
}

async function monterBob(m, iso) {
  const d = fauxDiscord();
  let now = new Date(iso);
  const horloge = () => now;
  const commandes = creerCommandes({ db: m.db, saspay: m.saspay, whop: m.whop, config: m.config, maintenant: horloge });
  const coaching = creerCoaching({ db: m.db, config: m.config, maintenant: horloge });
  const bob = creerBob({ config: m.config, db: m.db, commandes, coaching, maintenant: horloge, client: d.client, serveur: d.serveur });
  return { d, bob, coaching, avancer: (ms) => { now = new Date(now.getTime() + ms); }, aller: (x) => { now = new Date(x); } };
}

test('Bob : rappels à 10, 5, 3 jours et 24 h, sans doublon, puis retrait du serveur', async () => {
  const m = await monter();
  try {
    const mb = await inscrire(m, 'awa@example.com', { discordId: 'U1' });
    const fin = new Date(mb.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin - 20 * JOUR));
    b.d.ajouter('U1', [ROLES.community]);

    await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 0, '20 jours avant : rien');
    b.aller(fin - 10 * JOUR + 1000);
    await b.bob.renouvellements(); await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 1);
    assert.match(b.d.dms[0][1], /10 jours/);
    assert.match(b.d.dms[0][1], /community\/renouveler\?m=/);
    assert.match(b.d.dms[0][1], /3\s?280 FCFA/);
    b.aller(fin - 5 * JOUR + 1000); await b.bob.renouvellements();
    b.aller(fin - 3 * JOUR + 1000); await b.bob.renouvellements();
    b.aller(fin - 2 * 3600 * 1000); await b.bob.renouvellements(); await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 4);
    assert.match(b.d.dms[3][1], /Dernières 24 heures/);
    assert.match(b.d.dms[3][1], /repayer le prix d'entrée/);

    b.aller(fin + 1000);
    await b.bob.expirations();
    assert.deepStrictEqual(b.d.kicks, ['U1']);
    assert.strictEqual(m.db.prepare('SELECT statut FROM membres').get().statut, 'expire');
    assert.ok(b.d.dms.some(([id, t]) => id === 'U1' && /terminé/.test(t)));
    assert.ok(b.d.dms.some(([id, t]) => id === ADMIN && /retiré du serveur/.test(t)));
  } finally { await m.fermer(); }
});

test('Bob : un membre arrivé à 4 jours de la fin ne reçoit que le rappel utile', async () => {
  const m = await monter();
  try {
    const mb = await inscrire(m, 'awa@example.com', { discordId: 'U1' });
    const fin = new Date(mb.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin - 4 * JOUR));
    await b.bob.renouvellements();
    b.aller(fin - 3.5 * JOUR); await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 1);
    assert.match(b.d.dms[0][1], /5 jours/);
  } finally { await m.fermer(); }
});

test('Bob : Elite 10 jours avant la fin → alerte admin avec boutons ; GOAT → rappels de paiement', async () => {
  const m = await monter();
  try {
    const e = await inscrire(m, 'elite@example.com', { programme: 'elite', discordId: 'E1' });
    const g = await inscrire(m, 'goat@example.com', { programme: 'elite', discordId: 'G1' });
    const fin = new Date(e.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin - 9 * JOUR));
    b.d.ajouter('E1', [ROLES.elite]);
    b.d.ajouter('G1', [ROLES.elite, ROLES.goat]);
    m.db.prepare('UPDATE membres SET acces_jusqu_au = ? WHERE id = ?').run(e.acces_jusqu_au, g.id);
    await b.bob.renouvellements(); await b.bob.renouvellements();
    const versAdmin = b.d.dms.filter(([id]) => id === ADMIN);
    assert.strictEqual(versAdmin.length, 1);
    assert.match(versAdmin[0][1], /sort de l'\*\*Elite\*\*/);
    assert.strictEqual(versAdmin[0][2][0].components.length, 2);
    const versGoat = b.d.dms.filter(([id]) => id === 'G1');
    assert.match(versGoat[0][1], /coaching\/elite\/renouveler\?m=/);
    assert.match(versGoat[0][1], /39\s?360 FCFA/);
    assert.strictEqual(b.d.dms.filter(([id]) => id === 'E1').length, 0, 'Elite non classé : pas de demande de paiement');

    // L'admin clique « Insatisfait » : +90 jours gratuits.
    const reponses = [];
    await b.bob.surInteraction({
      user: { id: ADMIN }, isButton: () => true, customId: `elite:insatisfait:${e.id}`, message: { content: 'x' },
      update: async (o) => reponses.push(o), reply: async (o) => reponses.push(o),
    });
    const apres = m.db.prepare('SELECT * FROM membres WHERE id = ?').get(e.id);
    assert.strictEqual(apres.categorie_elite, 'insatisfait');
    assert.strictEqual(new Date(apres.acces_jusqu_au) - new Date(e.acces_jusqu_au), 90 * JOUR);
    assert.match(reponses[0].content, /Insatisfait/);
  } finally { await m.fermer(); }
});

test('Bob : rappels de coaching (perso, 1 h avant) et récap admin 2 h avant la première séance', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'elite@example.com', { programme: 'elite', discordId: 'E1' });
    const b = await monterBob(m, '2026-11-23T09:00:00.000Z');
    b.coaching.enregistrer('E1', [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' })), 180, 'elite1');

    b.aller('2026-11-23T11:30:00.000Z'); await b.bob.rappelsCoaching();
    assert.strictEqual(b.d.dms.length, 0, '3 h 30 avant : rien');
    b.aller('2026-11-23T12:00:01.000Z'); await b.bob.rappelsCoaching();
    assert.strictEqual(b.d.dms.length, 1, 'rappel personnalisé 3 h avant');
    b.aller('2026-11-23T13:00:00.000Z'); await b.bob.rappelsCoaching(); await b.bob.rappelsCoaching();
    b.aller('2026-11-23T14:00:00.000Z'); await b.bob.rappelsCoaching(); await b.bob.rappelsCoaching();
    const membre = b.d.dms.filter(([id]) => id === 'E1').map(([, t]) => t);
    const admin = b.d.dms.filter(([id]) => id === ADMIN).map(([, t]) => t);
    assert.strictEqual(membre.length, 2);
    assert.match(membre[0], /Rappel/);
    assert.match(membre[1], /1 heure/);
    assert.strictEqual(admin.length, 1);
    assert.match(admin[0], /localhost\/admin/);
  } finally { await m.fermer(); }
});

test('membre payé sur Whop (rôle Elite, sans fiche mobile money) : réserve, rappel enregistré ; créneaux libérés s\'il perd le rôle', async () => {
  const m = await monter();
  try {
    const b = await monterBob(m, '2026-11-23T09:00:00.000Z');
    b.d.ajouter('W1', [ROLES.elite]);
    assert.ok(b.coaching.enregistrer('W1', SEMAINE, 120, 'whopien').ok);
    assert.strictEqual(b.coaching.profil('W1').rappel_min, 120);
    assert.strictEqual(b.coaching.grille('W1').rappelMin, 120);
    await b.bob.libererCreneaux();
    assert.strictEqual(b.coaching.reserveurs().length, 1, 'rôle Elite présent : créneaux gardés');
    b.d.membres.get('W1').roles.cache.set.add(ROLES.goat);
    await b.bob.libererCreneaux();
    assert.strictEqual(b.coaching.reserveurs().length, 0);
    assert.ok(b.d.dms.some(([id, t]) => id === ADMIN && /whopien/.test(t) && /GOAT/.test(t)));
  } finally { await m.fermer(); }
});
