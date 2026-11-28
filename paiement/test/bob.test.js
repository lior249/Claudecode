'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { monter, configTest, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerSynchroWhop } = require('../src/synchro-whop');
const { creerCoaching } = require('../src/coaching');
const { creerBob } = require('../src/bob');
const { creerCommandes } = require('../src/commandes');

const JOUR = 86400000;
const urls = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.url));
const idsBoutons = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.custom_id)).filter(Boolean);
const ref = (s) => s.metadata.ref;

// Paiement en étant connecté avec un compte Discord à part ; sans discordId, le membre reste sans compte relié.
let compteur = 0;
async function inscrire(m, email, { programme = 'community', discordId } = {}) {
  const cookie = cookieSession(`P${++compteur}`, 'payeur');
  if (programme === 'community') await m.poster('/community/paiement', { nom: `Nom ${email}`, email }, { cookie });
  else await m.poster(new URL(m.commandes.creerInvitation().lien).pathname, { nom: `Nom ${email}`, email }, { cookie });
  m.saspay.payer(m.saspay.derniere().id);
  await m.etat(ref(m.saspay.derniere()));
  const mb = m.db.prepare('SELECT * FROM membres WHERE email = ? AND programme = ?').get(email, programme);
  m.db.prepare('UPDATE membres SET discord_id = ? WHERE id = ?').run(discordId || null, mb.id);
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

test('Whop : offre sans durée → rien à prolonger, et le site coupe l\'accès à la fin (une seule fois)', async () => {
  const m = await monter();
  try {
    m.whop.durees.plan_com = null;
    const mb = await inscrire(m, 'awa@example.com');
    let now = new Date();
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config, maintenant: () => now });
    m.whop.ajouterDemande('e1', 'awa@example.com');
    await synchro.executer();
    await m.poster('/community/renouveler', { nom: 'Awa', email: 'awa@example.com', m: require('../src/liens').jetonMembre('awa@example.com', m.config.secretApp) });
    m.saspay.payer(m.saspay.derniere().id);
    await m.etat(ref(m.saspay.derniere()));
    await synchro.executer();
    assert.ok(!m.whop.appels.some((a) => a[0] === 'prolonger'), 'pas de prolongation sur une offre sans durée');
    assert.ok(!m.whop.appels.some((a) => a[0] === 'annuler'));

    now = new Date(new Date(m.db.prepare('SELECT acces_jusqu_au a FROM membres WHERE id = ?').get(mb.id).a).getTime() + 1000);
    await synchro.executer(); await synchro.executer();
    assert.deepStrictEqual(m.whop.appels.filter((a) => a[0] === 'annuler'), [['annuler', 'mem_e1']]);
  } finally { await m.fermer(); }
});

// ---------- Coaching ----------

function coachingA(m, iso) {
  return creerCoaching({ db: m.db, config: m.config, maintenant: () => new Date(iso) });
}
const SEMAINE = [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' }));

test('coaching : 3 à 5 par semaine, un par jour, créneau déjà pris, limite de 11h00 GMT', async () => {
  const m = await monter();
  try {
    const lundi10h = coachingA(m, '2026-11-23T10:59:00.000Z'); // lundi
    assert.match(lundi10h.enregistrer('A', SEMAINE.slice(0, 2)).erreur, /au moins 3/);
    assert.match(lundi10h.enregistrer('A', [0, 1, 2, 3, 4, 5].map((jour) => ({ jour, heure: '16:00' }))).erreur, /5 créneaux au maximum/);
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
    assert.match(await (await m.get('/coaching', { cookie: '' })).text(), /Connecte ton compte Discord/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('G1') })).text(), /GOAT/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('C1') })).text(), /réservé aux membres Elite/);
    assert.match(await (await m.get('/coaching', { cookie: cookieSession('E1') })).text(), /Mes coachings/);

    const poster = (cookie, body) => fetch(`${m.base}/api/coaching/creneaux`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
    assert.strictEqual((await poster(cookieSession('G1'), { selection: SEMAINE })).status, 403);
    const ok = await poster(cookieSession('E1'), { selection: SEMAINE, rappelMin: 180 });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(recaps[0][0], 'E1');

    const connexionAdmin = await (await m.get('/admin', { cookie: '' })).text();
    assert.match(connexionAdmin, /Espace admin/);
    assert.match(connexionAdmin, /Connecte ton compte Discord/);
    assert.strictEqual((await m.get('/admin', { cookie: cookieSession('E1') })).status, 403);
    const admin = await (await m.get('/admin', { cookie: cookieSession(ADMIN) })).text();
    // Par défaut : la vue « Aujourd'hui », une seule colonne ; l'onglet Semaine garde la grille.
    assert.match(admin, /class="onglets-vue"[\s\S]*aria-current="page">Aujourd.{1,6}hui[\s\S]*class="jour-liste"/);
    assert.match(await (await m.get('/admin?vue=semaine', { cookie: cookieSession(ADMIN) })).text(), /Calendrier des coachings/);
    // Les créneaux fixes réservés commencent au plus tard la semaine suivante : une case réservée = un lien vers sa page.
    const lundiSuivant = m.coaching.ajouterJours(m.coaching.lundiDe(new Date()), 7);
    assert.match(await (await m.get(`/admin?semaine=${lundiSuivant}`, { cookie: cookieSession(ADMIN) })).text(), /href="\/admin\/creneau\?date=/);
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
    assert.match(urls(b.d.dms[0][2])[0], /\/connexion\/bob\?t=.*retour=%2Fcommunity%2Frenouveler$/, 'bouton personnel : connecte puis renouvelle');
    assert.doesNotMatch(b.d.dms[0][1], /https?:/, 'aucun lien brut dans le texte');
    assert.match(b.d.dms[0][1], /3\s?280 FCFA/);
    b.aller(fin - 5 * JOUR + 1000); await b.bob.renouvellements();
    b.aller(fin - 3 * JOUR + 1000); await b.bob.renouvellements();
    b.aller(fin - 2 * 3600 * 1000); await b.bob.renouvellements(); await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 4);
    assert.match(b.d.dms[3][1], /Dernières 24 heures/);
    assert.match(b.d.dms[3][1], /repayer le prix d'entrée/);

    assert.match(b.d.dms[3][1], /en attente/);

    // Fin : 15 jours en attente (rôle Attente, plus de rôle Community), pas encore retiré.
    b.aller(fin + 1000);
    await b.bob.expirations(); await b.bob.expirations();
    assert.deepStrictEqual(b.d.kicks, []);
    const roles = b.d.membres.get('U1').roles.cache.set;
    assert.ok(roles.has(ROLES.attente) && !roles.has(ROLES.community));
    assert.strictEqual(b.d.dms.filter(([id, t]) => id === 'U1' && /maintenant \*\*en attente\*\*/.test(t)).length, 1);
    assert.ok(m.commandes.peutRenouveler('community', 'awa@example.com'), 'renouvellement encore possible pendant l\'attente');

    b.aller(fin + 12.5 * JOUR); await b.bob.expirations(); await b.bob.expirations();
    assert.strictEqual(b.d.dms.filter(([id, t]) => id === 'U1' && /Plus que \*\*3 jours\*\*/.test(t)).length, 1);

    // Au bout de 15 jours : retiré du serveur.
    b.aller(fin + 15 * JOUR + 1000);
    await b.bob.expirations();
    assert.deepStrictEqual(b.d.kicks, ['U1']);
    assert.strictEqual(m.db.prepare('SELECT statut FROM membres').get().statut, 'expire');
    assert.ok(b.d.dms.some(([id, t]) => id === 'U1' && /repayer l'entrée/.test(t)));
    assert.ok(b.d.dms.some(([id, t]) => id === ADMIN && /retiré du serveur/.test(t)));
    assert.ok(!m.commandes.peutRenouveler('community', 'awa@example.com'));
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

test('Elite en paiement unique : aucun rappel, aucune alerte, personne retiré à la fin des 90 jours, accès Whop jamais coupé', async () => {
  const m = await monter();
  try {
    const e = await inscrire(m, 'elite@example.com', { programme: 'elite', discordId: 'E1' });
    const g = await inscrire(m, 'goat@example.com', { programme: 'elite', discordId: 'G1' });
    m.db.prepare("UPDATE membres SET whop_membership_id = 'mem_e' WHERE id = ?").run(e.id);
    const fin = new Date(e.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin - 9 * JOUR));
    b.d.ajouter('E1', [ROLES.elite]);
    b.d.ajouter('G1', [ROLES.elite, ROLES.goat]);
    await b.bob.renouvellements();
    b.aller(fin - 12 * 3600 * 1000); await b.bob.renouvellements();
    assert.strictEqual(b.d.dms.length, 0, 'ni rappel de paiement, ni alerte de classement');
    b.aller(fin + 30 * JOUR); await b.bob.expirations();
    assert.strictEqual(b.d.kicks.length, 0, 'personne retiré à la fin des 90 jours');
    assert.ok(b.d.membres.get('E1').roles.cache.set.has(ROLES.elite), 'rôle Elite gardé');
    assert.strictEqual(m.db.prepare('SELECT statut FROM membres WHERE id = ?').get(e.id).statut, 'actif');
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config, maintenant: () => new Date(fin + 30 * JOUR) });
    await synchro.executer();
    assert.ok(!m.whop.appels.some((a) => a[0] === 'annuler'), 'accès Whop Elite jamais coupé');
    assert.ok(g);
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
    const admin = b.d.dms.filter(([id]) => id === ADMIN).map(([, t, c]) => `${t} ${urls(c).join(' ')}`);
    assert.strictEqual(membre.length, 2);
    assert.match(membre[0], /Rappel/);
    assert.match(membre[1], /1 heure/);
    assert.strictEqual(admin.length, 1);
    assert.match(admin[0], /retour=%2Fadmin%3Fvue%3Djour%26date%3D/);
    assert.match(admin[0], /retour=%2Fadmin%2Fimprevu/, "bouton J'ai un imprévu");
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

test('renouvellement pendant l\'attente : rôle Community rendu, Attente retiré, accès Whop à redemander', async () => {
  const m = await monter();
  try {
    const mb = await inscrire(m, 'awa@example.com', { discordId: 'U1' });
    m.db.prepare("UPDATE membres SET whop_membership_id = 'mem_1', whop_entry_id = 'e1' WHERE id = ?").run(mb.id);
    const fin = new Date(mb.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin + 2 * JOUR));
    b.d.ajouter('U1', [ROLES.community]);
    await b.bob.expirations();
    m.db.prepare("UPDATE membres SET whop_annule_le = ? WHERE id = ?").run(new Date().toISOString(), mb.id); // coupé par la synchro Whop

    // Le membre renouvelle (vraie horloge du site = maintenant ; son accès est fini depuis 2 jours dans ce scénario).
    m.db.prepare('UPDATE membres SET acces_jusqu_au = ? WHERE id = ?').run(new Date(Date.now() - 2 * JOUR).toISOString(), mb.id);
    const jeton = require('../src/liens').jetonMembre('awa@example.com', m.config.secretApp);
    assert.strictEqual((await m.poster('/community/renouveler', { nom: 'Awa', email: 'awa@example.com', m: jeton })).status, 303);
    assert.strictEqual(m.saspay.derniere().amount, '3280.00', 'toujours au prix garanti');
    m.saspay.payer(m.saspay.derniere().id);
    const e = await m.etat(ref(m.saspay.derniere()));
    const page = await (await m.get(e.redirection)).text();
    assert.match(page, /Retrouve l(&#39;|')accès à la formation/);
    assert.match(page, /data-copier="awa@example\.com"/, 'email à copier en un clic');
    const apres = m.db.prepare('SELECT * FROM membres WHERE id = ?').get(mb.id);
    assert.strictEqual(apres.whop_membership_id, null);
    assert.ok((new Date(apres.acces_jusqu_au) - Date.now()) / JOUR > 29.9, '30 jours à partir d\'aujourd\'hui');

    b.aller(new Date());
    await b.bob.synchroRoles();
    const roles = b.d.membres.get('U1').roles.cache.set;
    assert.ok(roles.has(ROLES.community) && !roles.has(ROLES.attente));
  } finally { await m.fermer(); }
});

test('option ATTENTE_NOUVEAUX_HEURES=24 : retiré après 24 h, sauf candidature en cours et période d\'attente Community', async () => {
  const m = await monter({ avecCandidatures: true, config: configTest({ ATTENTE_NOUVEAUX_HEURES: '24' }) });
  try {
    const now = Date.now();
    const membres = new Map();
    const kicks = [];
    const retraits = [];
    const ajouter = (id, roles, ilYA) => membres.set(id, {
      id, joinedTimestamp: now - ilYA, user: { bot: false },
      roles: { cache: { has: (r) => roles.includes(r) }, remove: async (r) => retraits.push([id, r]) }, kick: async () => kicks.push(id),
    });
    const H = 3600 * 1000;
    ajouter('N1', [ROLES.attente], 25 * H); // nouveau venu depuis 25 h → retiré
    ajouter('N2', [ROLES.attente], 2 * H); // depuis 2 h → reste
    ajouter('N3', [ROLES.attente], 30 * H); // candidature en examen → reste
    ajouter('N4', [ROLES.attente, ROLES.community], 30 * H); // a un programme → reste
    ajouter('N5', [ROLES.attente], 30 * H); // Community dans ses 15 jours → reste
    ajouter(ADMIN, [ROLES.attente], 30 * H);
    m.candidatures.demarrer('N3', 'n3');
    m.candidatures.recevoirFormulaire('N3', [{ label: 'Q', valeur: 'R' }]);
    const mb = await inscrire(m, 'n5@example.com', { discordId: 'N5' });
    m.db.prepare('UPDATE membres SET acces_jusqu_au = ? WHERE id = ?').run(new Date(now - 2 * JOUR).toISOString(), mb.id);

    const dms = [];
    const bob = creerBob({
      config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content]) }) } },
      serveur: { members: { fetch: async (id) => (id ? membres.get(id) : membres) } },
    });
    await bob.nettoyerAttente();
    assert.deepStrictEqual(kicks, ['N1']);
    assert.ok(dms.some(([id, t]) => id === 'N1' && /en attente/.test(t)));
    assert.deepStrictEqual(retraits, [['N4', ROLES.attente]], 'membre d\'un programme : En Attente retiré');
  } finally { await m.fermer(); }
});

test('/configurer-attente : crée le salon d\'attente, bloque tous les autres salons pour En Attente, puis les nouveaux', async () => {
  const m = await monter();
  try {
    const edits = [];
    const envoyes = [];
    const salon = (id, extra = {}) => ({
      id, name: id, type: 0, parentId: null, permissionsLocked: false,
      permissionOverwrites: { edit: async (role, perms) => { if (id === 'prive') throw new Error('Missing Access'); edits.push([id, role, perms]); } },
      send: async (c) => envoyes.push([id, c]), ...extra,
    });
    const salons = new Map([['cat', salon('cat', { type: 4 })], ['general', salon('general', { parentId: 'cat' })], ['prive', salon('prive')]]);
    const serveur = {
      id: 'guild',
      members: { fetch: async () => new Map() },
      channels: {
        fetch: async (id) => (id ? (salons.get(id) || Promise.reject(new Error('inconnu'))) : salons),
        create: async (opts) => { const c = salon('attente', { name: opts.name }); c.opts = opts; salons.set('attente', c); return c; },
      },
    };
    const bob = creerBob({
      config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching,
      client: { isReady: () => true, user: { id: 'bot' }, users: { fetch: async () => ({ send: async () => {} }) } }, serveur,
    });
    const r = await bob.configurerAttente(null);
    assert.ok(r.ok);
    const cree = salons.get('attente');
    assert.strictEqual(cree.opts.name, 'en-attente');
    const ow = Object.fromEntries(cree.opts.permissionOverwrites.map((o) => [o.id, o]));
    assert.ok(ow.guild.deny.length && ow[ROLES.attente].allow.length, '@everyone ne voit pas, En Attente voit');
    assert.deepStrictEqual(edits.map((e) => e[0]).sort(), ['cat', 'general']);
    assert.ok(edits.every(([, role, p]) => role === ROLES.attente && p.ViewChannel === false));
    assert.deepStrictEqual(r.echecs, ['prive']);
    assert.match(envoyes[0][1].content, /Tu es en attente/);

    // Deuxième démarrage : même salon, message pas republié.
    const r2 = await bob.configurerAttente(null);
    assert.strictEqual(r2.salon.id, 'attente');
    assert.strictEqual(envoyes.length, 1);

    // Un nouveau salon est bloqué ; le salon d'attente lui-même ne l'est pas.
    assert.strictEqual(await bob.bloquerPourAttente(salon('nouveau')), 'bloqué');
    assert.strictEqual(await bob.bloquerPourAttente(cree), 'ignoré');
  } finally { await m.fermer(); }
});

test('espace de gestion : barre latérale (admin), page Membres réservée à l\'admin', async () => {
  const oauth = fauxOAuth({ E1: [ROLES.elite] });
  const m = await monter({ oauth });
  try {
    await inscrire(m, 'awa@example.com');
    const admin = cookieSession(ADMIN, 'Floh');
    const page = await (await m.get('/admin/membres', { cookie: admin })).text();
    assert.match(page, /<th>Paiement<\/th>/, 'une seule liste, le moyen de paiement en colonne');
    assert.match(page, /awa@example\.com/);
    assert.match(page, /class="sidebar"/);
    // Menu du coach épuré : Mon profil, À traiter, Calendrier, Élèves Elite, Planifier (les candidatures sont dans À traiter).
    assert.match(page, /href="\/coach"[\s\S]*href="\/admin\/a-traiter"[\s\S]*href="\/admin"[\s\S]*href="\/admin\/eleves"/);
    assert.ok(!/href="\/admin\/planifier"/.test(page.split('<main')[0]), 'plus de Planifier dans le menu');
    assert.doesNotMatch(page, /class="sb-lien[^"]*" href="\/admin\/(candidatures|membres|pages)"/);
    assert.match(page, /class="barre-bas"[^>]*repeat\(4[\s\S]*Profil[\s\S]*À traiter[\s\S]*Calendrier[\s\S]*Gestion/, 'barre du bas du coach : Profil, À traiter, Calendrier, Gestion');
    const gestion = await (await m.get('/admin/gestion', { cookie: cookieSession(ADMIN) })).text();
    assert.match(gestion, /Envoyer un message[\s\S]*href="\/admin\/eleves"[\s\S]*Gérer les élèves[\s\S]*href="\/admin\/evenements"/);
    assert.doesNotMatch(gestion, /href="\/ressources"/, 'Ressources cachées');
    assert.match(gestion, /class="actif" aria-current="page"[^>]*>[\s\S]{0,400}Gestion/);
    assert.match(await (await m.get('/coach', { cookie: cookieSession(ADMIN) })).text(), /À la une[\s\S]*Classement/);
    assert.strictEqual((await m.get('/admin/membres', { cookie: cookieSession('E1') })).status, 403);
    // Un membre Elite n'a pas les liens de gestion dans sa barre.
    const coaching = await (await m.get('/coaching', { cookie: cookieSession('E1', 'awa') })).text();
    assert.match(coaching, /Mes coachings/);
    assert.doesNotMatch(coaching, /href="\/admin\/membres"/);
  } finally { await m.fermer(); }
});

test('par défaut : les nouveaux venus restent en attente sans limite (seul En Attente est retiré aux membres d\'un programme)', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const kicks = []; const retraits = [];
    const membres = new Map([
      ['N1', { id: 'N1', joinedTimestamp: Date.now() - 30 * 24 * 3600 * 1000, user: { bot: false }, roles: { cache: { has: (r) => r === ROLES.attente }, remove: async () => retraits.push('N1') }, kick: async () => kicks.push('N1') }],
      ['N2', { id: 'N2', joinedTimestamp: Date.now(), user: { bot: false }, roles: { cache: { has: (r) => r === ROLES.attente || r === ROLES.community }, remove: async () => retraits.push('N2') }, kick: async () => kicks.push('N2') }],
    ]);
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
      client: { isReady: () => true, users: { fetch: async () => ({ send: async () => {} }) } }, serveur: { members: { fetch: async (id) => (id ? membres.get(id) : membres) } } });
    await bob.nettoyerAttente();
    assert.deepStrictEqual(kicks, [], 'personne n\'est retiré');
    assert.deepStrictEqual(retraits, ['N2']);
  } finally { await m.fermer(); }
});

test('arrivée sur le serveur : message privé de bienvenue au nouveau venu En Attente (une fois par arrivée)', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const dms = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
    const venu = (id, roles, joinedTimestamp = 1000, extra = {}) => ({
      id, joinedTimestamp, user: { bot: false }, pending: false, guild: { id: m.config.discord.serveurId },
      roles: { cache: { has: (r) => roles.includes(r) } }, ...extra,
    });

    assert.strictEqual(await bob.accueillir(venu('N1', [ROLES.attente])), true);
    assert.strictEqual(dms[0][0], 'N1', 'le message part au nouveau venu, pas à l\'admin');
    assert.match(dms[0][1], /Bienvenue sur le serveur Overmaxx/);
    const [community, elite] = urls(dms[0][2]);
    assert.match(community, /^http:\/\/localhost\/connexion\/bob\?t=.*retour=%2Fcommunity$/, 'boutons personnels : déjà connecté');
    assert.match(elite, /retour=%2Fcoaching%2Felite$/);
    assert.strictEqual(await bob.accueillir(venu('N1', [ROLES.attente])), false, 'pas de doublon (arrivée + rôle donné)');
    assert.strictEqual(await bob.accueillir(venu('N1', [ROLES.attente], 2000)), true, 'il revient : nouveau message');

    assert.strictEqual(await bob.accueillir(venu('N2', [])), false, 'pas (encore) le rôle En Attente');
    assert.strictEqual(await bob.accueillir(venu('N3', [ROLES.attente, ROLES.elite])), false, 'membre d\'un programme');
    assert.strictEqual(await bob.accueillir(venu(ADMIN, [ROLES.attente])), false);
    assert.strictEqual(await bob.accueillir(venu('N4', [ROLES.attente], 1000, { user: { bot: true } })), false);
    assert.strictEqual(await bob.accueillir(venu('N5', [ROLES.attente], 1000, { pending: true })), false, 'règles pas encore acceptées');
    assert.strictEqual(await bob.accueillir(venu('N5', [ROLES.attente])), true, 'dès qu\'il les accepte');

    // Candidat qui revient : on lui rappelle où en est sa candidature.
    m.candidatures.demarrer('N6', 'n6');
    m.candidatures.recevoirFormulaire('N6', [{ label: 'Q', valeur: 'R' }]);
    await bob.accueillir(venu('N6', [ROLES.attente]));
    const dm = dms.find(([id]) => id === 'N6');
    assert.match(dm[1], /candidature Elite est toujours en cours/);
    assert.match(urls(dm[2])[0], /\/connexion\/bob\?t=/);
    assert.ok(!dms.some(([id]) => id === ADMIN), 'l\'admin ne reçoit rien');
  } finally { await m.fermer(); }
});

test('pages du site : liste des liens et aperçus réservés à l\'admin ; vidéo Wistia quand elle est réglée', async () => {
  const m = await monter({ avecCandidatures: true, config: configTest({ WISTIA_ACCUEIL: 'abc123xyz' }) });
  try {
    const admin = cookieSession(ADMIN, 'admin');
    assert.match(await (await m.get('/')).text(), /fast\.wistia\.net\/embed\/iframe\/abc123xyz/);
    const liste = await (await m.get('/admin/pages', { cookie: admin })).text();
    assert.match(liste, /Pages du site/);
    assert.match(liste, /WISTIA_GUIDE_COMMUNITY/, 'indique quelle vidéo manque');
    for (const page of ['guide-community', 'guide-elite', 'candidature-examen', 'candidature-retenu', 'candidature-video', 'candidature-valide', 'candidature-refuse', 'paiement-elite']) {
      const r = await m.get(`/admin/apercu/${page}`, { cookie: admin });
      assert.strictEqual(r.status, 200, page);
    }
    assert.match(await (await m.get('/admin/apercu/guide-community', { cookie: admin })).text(), /video-vide/);
    assert.strictEqual((await m.get('/admin/apercu/inconnu', { cookie: admin })).status, 404);
    assert.strictEqual((await m.get('/admin/apercu/guide-elite', { cookie: cookieSession('123456789012345678', 'x') })).status, 403);
    assert.doesNotMatch(await (await m.get('/admin/pages')).text(), /Pages du site<\/h1>/, 'non connecté : connexion demandée');
  } finally { await m.fermer(); }
});

test('accès Whop : page après paiement en une étape (email + Copier) ; correction de l\'email Whop par le membre ; relances de Bob', async () => {
  const m = await monter();
  try {
    const cookie = cookieSession('W1', 'awa');
    await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' }, { cookie });
    const s = m.saspay.derniere();
    m.saspay.payer(s.id);
    await m.etat(ref(s));
    const guide = await (await m.get(`/acces/${ref(s)}`)).text();
    assert.match(guide, /Débloque ta formation sur Whop/);
    assert.match(guide, /data-copier="awa@example\.com"/);
    assert.match(guide, /href="\/acces\/email-whop"/);
    assert.match(guide, /Discord connecté \(awa\)/);

    // Le membre a donné un autre email à Whop : il le corrige ; la synchro l'accepte avec celui-là.
    assert.match(await (await m.get('/acces/email-whop', { cookie })).text(), /Quel email as-tu donné à Whop/);
    assert.strictEqual((await m.poster('/acces/email-whop', { email: 'pas-un-email' }, { cookie })).status, 400);
    assert.match(await (await m.poster('/acces/email-whop', { email: 'Awa.Perso@Gmail.com' }, { cookie })).text(), /C(&#39;|')est noté/);
    const notifs = [];
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config, notifier: { admin: async (t) => notifs.push(t) } });
    m.whop.ajouterDemande('e9', 'awa.perso@gmail.com');
    m.whop.ajouterDemande('e10', 'inconnu@example.com', 'plan_com', 3600 * 1000);
    await synchro.executer(); await synchro.executer();
    assert.deepStrictEqual(m.whop.appels[0], ['accepter', 'e9']);
    assert.strictEqual(notifs.filter((t) => /inconnu@example\.com/.test(t)).length, 1, 'admin prévenu tout de suite, une seule fois');
    assert.ok(!m.whop.appels.some((a) => a[1] === 'e10'), 'pas encore refusée (moins de 48 h)');
    // Un autre membre ne peut pas prendre cet email.
    assert.strictEqual((await m.poster('/acces/email-whop', { email: 'awa@example.com' }, { cookie: cookieSession('W2') })).status, 200, 'W2 n\'a pas d\'accès en attente');

    // Relances de Bob : 1 h puis 24 h après le paiement, puis l'admin à 48 h.
    m.db.prepare('UPDATE membres SET whop_membership_id = NULL, whop_entry_id = NULL, email_whop = NULL').run();
    const payeLe = new Date(m.db.prepare('SELECT payee_le FROM commandes WHERE ref = ?').get(ref(s)).payee_le).getTime();
    const b = await monterBob(m, new Date(payeLe + 30 * 60 * 1000));
    await b.bob.relancerWhop();
    assert.strictEqual(b.d.dms.length, 0, '30 min : rien');
    b.aller(payeLe + 61 * 60 * 1000); await b.bob.relancerWhop(); await b.bob.relancerWhop();
    assert.strictEqual(b.d.dms.length, 1);
    const [id, texte, composants] = b.d.dms[0];
    assert.strictEqual(id, 'W1');
    assert.match(texte, /exactement cet email : \*\*awa@example\.com\*\*/);
    const [etapes, correction] = urls(composants);
    assert.strictEqual(etapes, `http://localhost/acces/${ref(s)}`);
    assert.match(correction, /retour=%2Facces%2Femail-whop$/);
    b.aller(payeLe + 25 * 3600 * 1000); await b.bob.relancerWhop();
    assert.strictEqual(b.d.dms.length, 2);
    b.aller(payeLe + 49 * 3600 * 1000); await b.bob.relancerWhop();
    assert.ok(b.d.dms.some(([qui, t]) => qui === ADMIN && /plus de 48 h/.test(t)));
    assert.strictEqual(b.d.dms.filter(([qui]) => qui === 'W1').length, 2, 'pas de 3e relance au membre');
  } finally { await m.fermer(); }
});

test('membres payés par carte : rôle donné par le bot de Whop, prévenus quand Whop le retire, Community 15 jours En Attente puis retrait', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'mobile@example.com', { discordId: 'U1' });
    let now = new Date('2026-12-01T10:00:00Z');
    const dms = [];
    const kicks = [];
    const membres = new Map();
    const ajouter = (id, roles) => {
      const set = new Set(roles);
      membres.set(id, { id, user: { bot: false, username: `pseudo_${id}` },
        roles: { cache: { has: (r) => set.has(r), set }, add: async (r) => set.add(r), remove: async (r) => set.delete(r) },
        kick: async () => { kicks.push(id); membres.delete(id); } });
    };
    ajouter('C1', [ROLES.community]); ajouter('C2', [ROLES.community]); ajouter('E9', [ROLES.elite]); ajouter('U1', [ROLES.community]);
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } },
      serveur: { members: { fetch: async (id) => (id === undefined ? membres : membres.get(id) || null) } } });

    // Le journal d'audit du serveur dit que c'est le bot de Whop qui a donné les rôles.
    const whop = { id: 'WHOPBOT', bot: true, pseudo: 'Whop' };
    for (const [id, o] of [['C1', 'community'], ['C2', 'community'], ['E9', 'elite'], ['U1', 'community']]) await bob.roleRecu(membres.get(id), m.config.offres[o], { auteur: whop });
    await bob.suivreCarte();
    const cartes = () => m.db.prepare('SELECT * FROM abonnes_carte ORDER BY discord_id').all();
    assert.deepStrictEqual(cartes().map((c) => `${c.discord_id}:${c.programme}:${c.source}`), ['C1:community:whop', 'C2:community:whop', 'E9:elite:whop'], 'U1 paie en mobile money : pas compté');
    assert.strictEqual(dms.length, 0, 'aucun message quand tout va bien (pas de rappel avant la fin, aucune question au coach)');

    // Whop retire les rôles (carte refusée).
    membres.get('C1').roles.cache.set.delete(ROLES.community);
    membres.get('C2').roles.cache.set.delete(ROLES.community);
    membres.get('E9').roles.cache.set.delete(ROLES.elite);
    await bob.suivreCarte(); await bob.suivreCarte();
    assert.ok(membres.get('C1').roles.cache.set.has(ROLES.attente), 'Community : En Attente');
    const versC1 = dms.filter(([id]) => id === 'C1');
    assert.strictEqual(versC1.length, 1);
    assert.match(versC1[0][1], /par carte s'est arrêté[\s\S]*15 jours/);
    assert.ok(dms.some(([id, t]) => id === ADMIN && /E9/.test(t) && /Elite/.test(t)), 'Elite : l\'admin est prévenu');
    assert.ok(!dms.some(([id]) => id === 'E9'));

    // C2 reprend son abonnement : le rôle revient.
    membres.get('C2').roles.cache.set.add(ROLES.community);
    await bob.suivreCarte();
    assert.strictEqual(cartes().find((c) => c.discord_id === 'C2').perdu_le, null);

    // 16 jours plus tard : C1 retiré du serveur.
    now = new Date('2026-12-17T10:00:00Z');
    await bob.suivreCarte();
    assert.deepStrictEqual(kicks, ['C1']);
    assert.ok(cartes().find((c) => c.discord_id === 'C1').termine_le);

    const page = await (await m.get('/admin/membres', { cookie: cookieSession(ADMIN, 'admin') })).text();
    assert.match(page, /pseudo_C2/);
    assert.match(page, /Carte arrêtée le/);
  } finally { await m.fermer(); }
});

test('progression Whop : compte Whop gardé à l\'acceptation, leçons terminées lues dans les cours et affichées dans Membres', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'awa@example.com', { discordId: 'U1' });
    m.whop.ajouterDemande('e1', 'awa@example.com');
    m.whop.demandes.get('e1').user.id = 'user_9';
    const activites = [
      { user: { id: 'user_9' }, lesson: { id: 'l1' }, completed: true, updated_at: '2026-11-25T10:00:00Z' },
      { user_id: 'user_9', lesson_id: 'l2', completed_at: '2026-11-25T11:00:00Z' },
      { user: { id: 'user_9' }, lesson: { id: 'l3' }, completed: false },
    ];
    m.whop.cours = async () => [{ id: 'cours_1', title: 'TikTok OVM - Formation', total_lessons_count: 20 }];
    m.whop.activiteLecons = async (id) => (id === 'cours_1' ? activites : []);
    const synchro = creerSynchroWhop({ db: m.db, whop: m.whop, config: m.config });
    await synchro.executer();
    assert.strictEqual(m.db.prepare('SELECT whop_user_id FROM membres').get().whop_user_id, 'user_9');
    assert.strictEqual(m.db.prepare('SELECT SUM(termine) n FROM progression_whop WHERE whop_user_id = ?').get('user_9').n, 2);
    const page = await (await m.get('/admin/membres', { cookie: cookieSession(ADMIN, 'admin') })).text();
    assert.match(page, /2 \/ 20/);
    await synchro.executer();
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM progression_whop').get().n, 3, 'pas de doublon');
  } finally { await m.fermer(); }
});

test('le coach (admin) ne réserve pas de coaching et ne postule pas à l\'Elite ; il garde ses aperçus', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const admin = cookieSession(ADMIN, 'overmaxx');
    assert.strictEqual((await m.get('/coaching', { cookie: admin })).headers.get('location'), '/admin');
    const r = await fetch(`${m.base}/api/coaching/creneaux`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: admin },
      body: JSON.stringify({ selection: [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' })) }) });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await m.get('/coaching/elite', { cookie: admin })).headers.get('location'), '/admin/candidatures');
    assert.strictEqual((await m.get('/coaching/elite/candidature', { cookie: admin })).headers.get('location'), '/admin/candidatures');
    const f = await fetch(`${m.base}/api/candidature/formulaire`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: admin }, body: JSON.stringify({ reponses: { nom: 'Moi' } }) });
    assert.strictEqual(f.status, 403);
    assert.strictEqual(m.candidatures.parDiscord(ADMIN), null);
    const espace = await (await m.get('/admin', { cookie: admin })).text();
    assert.doesNotMatch(espace, /Mes coachings/, 'pas de « Mes coachings » dans le menu du coach');
    for (const page of ['candidature', 'coaching']) assert.strictEqual((await m.get(`/admin/apercu/${page}`, { cookie: admin })).status, 200, page);

    // /connexion dans Discord : seulement l'espace admin.
    const reponses = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
      client: { isReady: () => true, users: { fetch: async () => ({ send: async () => {} }) } },
      serveur: { members: { fetch: async () => ({ roles: { cache: { has: () => false } } }) } } });
    await bob.surInteraction({ user: { id: ADMIN, username: 'overmaxx' }, isButton: () => false, isChatInputCommand: () => true, commandName: 'connexion', reply: async (o) => reponses.push(o) });
    const libelles = reponses[0].components.flatMap((rangee) => rangee.components.map((b) => b.data.label));
    assert.deepStrictEqual(libelles, ['Espace admin', 'Candidatures', 'Membres']);
  } finally { await m.fermer(); }
});

test('rôle donné à la main : Bob demande au coach Oui ou Non ; Oui ouvre le site, Non le ferme sans toucher au rôle', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'mobile@example.com', { discordId: 'U1' });
    const now = new Date('2026-12-01T10:00:00Z');
    const dms = [];
    const membres = new Map();
    const journal = [];
    const ajouter = (id, roles) => {
      const set = new Set(roles);
      membres.set(id, { id, user: { bot: false, username: `pseudo_${id}` }, roles: { cache: { has: (r) => set.has(r), set }, add: async (r) => set.add(r), remove: async (r) => set.delete(r) } });
      return membres.get(id);
    };
    // Un rôle donné : l'événement Discord et sa ligne dans le journal d'audit.
    const donner = async (id, role, executor) => {
      const membre = membres.get(id) || ajouter(id, []);
      const avant = { partial: false, roles: { cache: { has: (r) => membre.roles.cache.set.has(r) } } };
      const copie = new Set(membre.roles.cache.set);
      avant.roles.cache.has = (r) => copie.has(r);
      membre.roles.cache.set.add(role);
      journal.push({ targetId: id, createdTimestamp: now.getTime(), executor, changes: [{ key: '$add', new: [{ id: role }] }] });
      await bob.surRoleAjoute(avant, membre);
    };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, accesManuels: m.acces,
      maintenant: () => now, attendre: async () => {},
      client: { isReady: () => true, user: { id: 'BOB' }, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } },
      serveur: { members: { fetch: async (id) => (id === undefined ? membres : membres.get(id) || null) },
        fetchAuditLogs: async () => ({ entries: new Map(journal.map((e, k) => [String(k), e])) }) } });
    // Le site passe par le même Bob (décisions prises sur le site).
    const cliquer = async (customId, qui = ADMIN) => {
      const r = {};
      await bob.surInteraction({ isButton: () => true, isChatInputCommand: () => false, customId, user: { id: qui }, message: { content: 'question' },
        update: async (x) => { r.update = x; }, reply: async (x) => { r.reply = x; } });
      return r;
    };
    const versAdmin = () => dms.filter(([id]) => id === ADMIN);
    const ids = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.custom_id || b.data.url));

    // 1. Le coach donne le rôle Elite à M1 à la main : question avec Oui / Non.
    await donner('M1', ROLES.elite, { id: ADMIN, bot: false, username: 'coach_ovx' });
    assert.strictEqual(versAdmin().length, 1);
    const [, texte, composants] = versAdmin()[0];
    assert.match(texte, /\*\*pseudo_M1\*\* \(<@M1>\) a reçu le rôle \*\*Overmaxx Elite\*\* sans avoir payé sur le site \(rôle donné par \*\*coach_ovx\*\*\)/);
    assert.match(texte, /Lui donner accès au site quand même \?/);
    assert.deepStrictEqual(ids(composants), ['acces:oui:elite:M1', 'acces:non:elite:M1']);
    assert.strictEqual((await m.get('/parcours', { cookie: cookieSession('M1', 'pseudo_M1') })).status, 403, 'pas encore d\'accès au site');
    await bob.suivreCarte();
    assert.strictEqual(versAdmin().length, 1, 'pas de seconde question');

    // Un membre ne peut pas répondre à sa place.
    assert.match((await cliquer('acces:oui:elite:M1', 'M1')).reply.content, /Réservé à l'admin/);
    // Oui : accès au site, il est prévenu ; le message de Bob garde la réponse.
    const r1 = await cliquer('acces:oui:elite:M1');
    assert.match(r1.update.content, /Accès au site donné/);
    assert.deepStrictEqual(r1.update.components, []);
    const versM1 = dms.filter(([id]) => id === 'M1');
    assert.strictEqual(versM1.length, 1);
    assert.match(versM1[0][1], /Ton accès au site Overmaxx est ouvert/);
    assert.match(urls(versM1[0][2])[0], /retour=%2Fapp$/);
    assert.strictEqual((await m.get('/parcours', { cookie: cookieSession('M1', 'pseudo_M1') })).status, 200);
    assert.strictEqual(m.db.prepare("SELECT source FROM abonnes_carte WHERE discord_id = 'M1'").get().source, 'main');
    assert.match((await cliquer('acces:non:elite:M1')).reply.content, /Déjà fait/);

    // 2. Rôle donné par le bot de Whop (carte) : pas de question. Rôle donné par Bob (paiement mobile money) : rien non plus.
    await donner('C5', ROLES.community, { id: 'WHOPBOT', bot: true, username: 'Whop' });
    await donner('U1', ROLES.community, { id: 'BOB', bot: true, username: 'Bob' });
    assert.strictEqual(versAdmin().length, 1);
    assert.strictEqual(m.db.prepare("SELECT source FROM abonnes_carte WHERE discord_id = 'C5'").get().source, 'whop');

    // 3. Repéré par le passage de Bob (rôle donné quand Bob était éteint) : question ; Non depuis le site.
    ajouter('M2', [ROLES.community]);
    await bob.suivreCarte();
    assert.strictEqual(versAdmin().length, 2);
    assert.match(versAdmin()[1][1], /pseudo_M2[\s\S]*Overmaxx Community[\s\S]*Si c'est un paiement par carte sur Whop, réponds Oui/);
    const admin = { cookie: cookieSession(ADMIN, 'coach') };
    let page = await (await m.get('/admin/a-traiter', admin)).text();
    assert.match(page, /pseudo_M2[\s\S]*Rôle donné à la main[\s\S]*data-cat="acces">Accès au site/);
    assert.match(page, /action="\/admin\/acces\/community\/M2"/);
    const rep = await m.poster('/admin/acces/community/M2', { decision: 'non' }, admin);
    assert.strictEqual(rep.status, 303);
    assert.strictEqual(m.acces.get('M2', 'community').statut, 'refuse');
    assert.ok(!dms.some(([id]) => id === 'M2'), 'Non : rien envoyé au membre');
    assert.ok(membres.get('M2').roles.cache.set.has(ROLES.community), 'son rôle Discord reste');
    await bob.suivreCarte();
    assert.strictEqual(versAdmin().length, 2, 'refusé : on ne redemande pas');

    // 4. Avant la validation, L1 avait déjà accès (repéré comme carte) : il le garde en attendant ; Non ferme son parcours, Oui le rouvre.
    ajouter('L1', [ROLES.elite]);
    m.db.prepare("INSERT INTO abonnes_carte (discord_id, programme, pseudo, depuis) VALUES ('L1', 'elite', 'pseudo_L1', ?)").run(now.toISOString());
    m.db.prepare("INSERT INTO acces_manuels (discord_id, programme, pseudo, statut, ancien, demande_le) VALUES ('L1', 'elite', 'pseudo_L1', 'attente', 1, ?)").run(now.toISOString());
    m.parcours.assurer('L1', { pseudo: 'pseudo_L1' });
    const eleve = { cookie: cookieSession('L1', 'pseudo_L1') };
    assert.strictEqual((await m.get('/parcours', eleve)).status, 200, 'en attendant ta réponse, il garde l\'accès');
    await bob.suivreCarte();
    const question = versAdmin()[2];
    assert.match(question[1], /a le rôle \*\*Overmaxx Elite\*\* sans avoir payé sur le site\. Il a déjà accès au site/);
    assert.deepStrictEqual(ids(question[2]), ['acces:oui:elite:L1', 'acces:non:elite:L1']);
    assert.match((await cliquer('acces:non:elite:L1')).update.content, /Accès au site retiré \(son rôle Discord reste\)/);
    assert.strictEqual((await m.get('/parcours', eleve)).status, 403);
    assert.ok(!m.parcours.tous().some((p) => p.discord_id === 'L1'), 'hors du tableau des élèves et du classement');
    assert.ok(m.parcours.get('L1'), 'rien n\'est effacé');
    page = await (await m.get('/admin/a-traiter', admin)).text();
    assert.match(page, /Accès au site refusés \(2\)[\s\S]*pseudo_L1/);
    await m.poster('/admin/acces/elite/L1', { decision: 'oui' }, admin);
    assert.strictEqual((await m.get('/parcours', eleve)).status, 200, 'accès rouvert, parcours retrouvé');

    // 5. Le coach retire le rôle donné à la main : le site se ferme sans message ; il le redonne : le site se rouvre sans question.
    membres.get('M1').roles.cache.set.delete(ROLES.elite);
    await bob.suivreCarte();
    assert.ok(m.db.prepare("SELECT termine_le FROM abonnes_carte WHERE discord_id = 'M1'").get().termine_le);
    assert.strictEqual(dms.filter(([id]) => id === 'M1').length, 1, 'pas de message « carte arrêtée »');
    await donner('M1', ROLES.elite, { id: ADMIN, bot: false, username: 'coach_ovx' });
    assert.strictEqual(m.db.prepare("SELECT termine_le FROM abonnes_carte WHERE discord_id = 'M1'").get().termine_le, null);
    assert.strictEqual(versAdmin().length, 3);

    // 6. Beaucoup d'un coup (premier passage) : un seul message, la liste sur le site.
    for (let k = 0; k < 6; k++) ajouter(`N${k}`, [ROLES.community]);
    await bob.suivreCarte();
    assert.strictEqual(versAdmin().length, 4);
    assert.match(versAdmin()[3][1], /\*\*6 personnes\*\* ont un rôle Overmaxx sans avoir payé sur le site/);
    assert.match(urls(versAdmin()[3][2])[0], /retour=%2Fadmin%2Fa-traiter%23acces$/);
    page = await (await m.get('/admin/a-traiter', admin)).text();
    assert.strictEqual((page.match(/action="\/admin\/acces\/community\/N\d"/g) || []).length, 6);
  } finally { await m.fermer(); }
});

test('Deux serveurs : à la fin de l\'attente, retiré du serveur membres, gardé sur le serveur gratuit (rôle d\'attente)', async () => {
  const m = await monter();
  try {
    m.config.discord.serveurAttenteId = 'ANCIEN';
    m.config.discord.roleAttenteAncien = 'ROLE_ANCIEN';
    m.config.lienDiscord = 'https://discord.gg/gratuit';
    const mb = await inscrire(m, 'awa@example.com', { discordId: 'U1' });
    const fin = new Date(mb.acces_jusqu_au).getTime();
    const b = await monterBob(m, new Date(fin + 1000));
    b.d.ajouter('U1', [ROLES.community]);
    // L'ancien serveur : U1 y est déjà.
    const ancien = new Set();
    b.d.client.guilds = { fetch: async (id) => { assert.strictEqual(id, 'ANCIEN'); return { members: { fetch: async (x) => {
      if (x !== 'U1') throw new Error('absent');
      return { roles: { cache: { has: (r) => ancien.has(r) }, add: async (r) => ancien.add(r) } };
    } } }; } };
    await b.bob.expirations();
    assert.match(b.d.dms.find(([id]) => id === 'U1')[1], /retiré du serveur des membres \(tu restes le bienvenu sur le serveur gratuit\)/);
    b.aller(fin + 15 * JOUR + 1000);
    await b.bob.expirations();
    assert.deepStrictEqual(b.d.kicks, ['U1']);
    assert.ok(ancien.has('ROLE_ANCIEN'), 'rôle d\'attente donné sur l\'ancien serveur');
    assert.ok(b.d.dms.some(([id, t]) => id === 'U1' && /Tu restes sur le \*\*serveur gratuit\*\*/.test(t)));
  } finally { await m.fermer(); }
});

test('Deux serveurs : Bob détecte l\'ancien serveur tout seul, y crée une invitation, et les liens changent', async () => {
  const m = await monter();
  try {
    m.config.lienDiscord = 'https://discord.gg/membres';
    m.config.discord.attenteNouveauxHeures = 0;
    m.config.discord.attenteNouveauxHeuresChoisi = false;
    const b = await monterBob(m, new Date());
    const ancien = { id: 'ANCIEN', name: 'Overmaxx (ancien)', systemChannel: null,
      members: { fetchMe: async () => ({}) },
      channels: { fetch: async () => new Map([['s1', { isTextBased: () => true, permissionsFor: () => ({ has: () => true }), createInvite: async () => ({ url: 'https://discord.gg/gratuit' }) }]]) } };
    b.d.client.guilds = { cache: new Map([[m.config.discord.serveurId, { id: m.config.discord.serveurId }], ['ANCIEN', ancien]]), fetch: async () => ancien };
    await b.bob.detecterServeurAttente();
    assert.strictEqual(m.config.discord.serveurAttenteId, 'ANCIEN');
    assert.strictEqual(m.config.lienDiscord, 'https://discord.gg/gratuit', 'lien public : le serveur gratuit');
    assert.strictEqual(m.config.discord.lienMembres, 'https://discord.gg/membres', 'après paiement : le serveur des membres');
    assert.strictEqual(m.config.discord.attenteNouveauxHeures, 24);
    assert.ok(b.d.dms.some(([id, t]) => id === ADMIN && /Serveur gratuit détecté : Overmaxx \(ancien\)/.test(t)));
    // Au redémarrage : l'invitation est réutilisée, pas de nouveau message.
    const n = b.d.dms.length;
    await b.bob.detecterServeurAttente();
    assert.strictEqual(b.d.dms.length, n);
  } finally { await m.fermer(); }
});

test('lancement du call : 10 min avant, Bob demande au coach (bouton Oui) ; l\'invitation part une seule fois, avec le lien, et le coach est prévenu', async () => {
  const m = await monter();
  try {
    await inscrire(m, 'elite@example.com', { programme: 'elite', discordId: 'E1' });
    const b = await monterBob(m, '2026-11-23T09:00:00.000Z');
    b.coaching.enregistrer('E1', [0, 1, 2, 3].map((jour) => ({ jour, heure: '15:00' })), 180, 'elite1');
    m.db.prepare("INSERT INTO reglages (cle, valeur, maj_le) VALUES ('lien_call', 'https://discord.com/channels/1/2', ?)").run(new Date().toISOString());
    b.aller('2026-11-23T14:45:00.000Z'); await b.bob.rappelsCoaching();
    assert.ok(!b.d.dms.some(([id, t]) => id === ADMIN && /Call avec/.test(t)), '15 min avant : pas encore');
    b.aller('2026-11-23T14:50:30.000Z'); await b.bob.rappelsCoaching(); await b.bob.rappelsCoaching();
    const demandes = b.d.dms.filter(([id, t]) => id === ADMIN && /Call avec .* dans 10 minutes/.test(t));
    assert.strictEqual(demandes.length, 1, 'une seule demande');
    assert.ok(idsBoutons(demandes[0][2]).includes('call:2026-11-23_1500_E1'));
    await b.bob.envoyerInvitationCall('E1', '2026-11-23', '15:00');
    const r2 = await b.bob.envoyerInvitationCall('E1', '2026-11-23', '15:00');
    assert.ok(r2.deja, 'une seule invitation');
    const invit = b.d.dms.filter(([id, t]) => id === 'E1' && /Ton coaching commence dans 5 minutes/.test(t));
    assert.strictEqual(invit.length, 1);
    assert.deepStrictEqual(urls(invit[0][2]), ['https://discord.com/channels/1/2']);
    assert.ok(b.d.dms.some(([id, t]) => id === ADMIN && /Lien du call envoyé à .*rejoins le salon de coaching privé/.test(t)));
    // Sans réponse du coach : 5 minutes avant, le lien part tout seul (élève et coach), une seule fois.
    b.aller('2026-11-24T14:55:30.000Z'); await b.bob.rappelsCoaching(); await b.bob.rappelsCoaching();
    const auto = b.d.dms.filter(([id, t]) => id === 'E1' && /Ton coaching commence dans 5 minutes[\s\S]*15:00/.test(t));
    assert.strictEqual(auto.length, 2, 'lundi (bouton) et mardi (automatique)');
    assert.deepStrictEqual(urls(auto[1][2]), ['https://discord.com/channels/1/2']);
    assert.strictEqual(b.d.dms.filter(([id, t]) => id === ADMIN && /Lien du call envoyé/.test(t)).length, 2);
  } finally { await m.fermer(); }
});

test('coaching à valider : Bob envoie Valider / Invalider ; Invalider → les 3 raisons ; Autre → fenêtre pour écrire', async () => {
  const m = await monter();
  try {
    const b = await monterBob(m, '2026-11-30T15:40:00.000Z');
    const decisions = [];
    b.bob.decisionCoaching = (...a) => { decisions.push(a); return { validation: { raison: a[2] } }; };
    await b.bob.parcours.coachingAValider({ discord_id: 'E1', pseudo: 'awa' }, { id: 7 }, '30/11/2026 à 15:00 GMT');
    const dm = b.d.dms.filter(([id]) => id === ADMIN).pop();
    assert.match(dm[1], /valider le coaching du 30\/11\/2026 à 15:00 GMT/);
    assert.deepStrictEqual(idsBoutons(dm[2]).filter(Boolean), ['valid:ok:7', 'valid:non:7']);
    const maj = [];
    const inter = (customId, extra = {}) => ({ user: { id: ADMIN }, customId, isButton: () => true, isModalSubmit: () => false, isChatInputCommand: () => false,
      message: { content: dm[1] }, update: async (o) => maj.push(o), reply: async (o) => maj.push(o), showModal: async (o) => maj.push({ modal: o }), ...extra });
    await b.bob.surInteraction(inter('valid:non:7'));
    const ids = maj[0].components[0].toJSON().components.map((c) => c.custom_id);
    assert.deepStrictEqual(ids, ['valid:r:7:coach', 'valid:r:7:eleve', 'valid:r:7:autre', 'valid:ok:7']);
    await b.bob.surInteraction(inter('valid:r:7:coach'));
    assert.deepStrictEqual(decisions[0], ['7', 'invalider', 'coach', '']);
    assert.match(maj[1].content, /Invalidé : tu n'étais pas disponible/);
    await b.bob.surInteraction(inter('valid:r:7:autre'));
    assert.ok(maj[2].modal, 'Autre : une fenêtre pour écrire la raison');
    await b.bob.surInteraction(inter('valid:autre:7', { isButton: () => false, isModalSubmit: () => true, fields: { getTextInputValue: () => 'Coupure internet' } }));
    assert.deepStrictEqual(decisions[1], ['7', 'invalider', 'autre', 'Coupure internet']);
    await b.bob.surInteraction(inter('valid:ok:7'));
    assert.deepStrictEqual(decisions[2], ['7', 'valider']);
    assert.match(maj.pop().content, /\*\*Validé\.\*\*/);
  } finally { await m.fermer(); }
});
