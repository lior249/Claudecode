'use strict';

// Communauté : chaîne d'activité, suivis (10 places), concurrences (3, invitation acceptée), notifications de résultats,
// page Mon profil (roue des jours) et barre du bas.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');

const jourIl = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
function eleve(m, id, { etape = 4 } = {}) {
  m.parcours.assurer(id, { pseudo: `p_${id}`, nom: `${id} Nom-complet` });
  m.db.prepare('UPDATE parcours SET etape = ? WHERE discord_id = ?').run(etape, id);
}
function compteRendu(m, id, jour, { etat = 'valide', total = 0, vues = 0 } = {}) {
  m.db.prepare("INSERT INTO publications (discord_id, jour, lien, cree_le) VALUES (?, ?, ?, ?)").run(id, jour, `https://tiktok.com/${id}/${jour}`, new Date().toISOString());
  const r = m.db.prepare('INSERT INTO comptes_rendus (discord_id, jour, etat, total_mois, vues_jour, envoye_le, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, jour, etat, total, vues, new Date().toISOString(), new Date().toISOString());
  return Number(r.lastInsertRowid);
}

test('chaîne : 3 jours d\'affilée allument la flamme, un jour manqué la casse', async () => {
  const { creerCommunaute } = require('../src/communaute');
  const m = await monter();
  try {
    const c = creerCommunaute({ db: m.db, parcours: m.parcours, suivi: m.suivi });
    eleve(m, 'A'); eleve(m, 'B'); eleve(m, 'C');
    for (const n of [1, 2, 3]) compteRendu(m, 'A', jourIl(n));
    for (const n of [1, 3, 4]) compteRendu(m, 'B', jourIl(n));
    compteRendu(m, 'C', jourIl(5)); compteRendu(m, 'C', jourIl(6)); compteRendu(m, 'C', jourIl(7));
    assert.strictEqual(c.chaine('A'), 3);
    assert.ok(c.flamme(c.chaine('A')));
    assert.strictEqual(c.chaine('B'), 1, 'jour manqué : la chaîne repart');
    assert.strictEqual(c.chaine('C'), 0, 'plus rien depuis 5 jours : brisée');
  } finally { await m.fermer(); }
});

test('suivre (10 places), défier (3 concurrents), résultats envoyés à ceux qui suivent, concurrence gagnée', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); } }) };
  const m = await monter({ bob });
  try {
    for (let k = 0; k < 13; k++) eleve(m, `E${k}`);
    eleve(m, 'N', { etape: 2 });
    for (let k = 0; k < 13; k++) compteRendu(m, `E${k}`, jourIl(2), { total: 100 + k, vues: 1000 * k });
    const cookie = (id) => ({ cookie: cookieSession(id, `p_${id}`) });
    const suivre = (de, id) => m.poster('/communaute/suivre', { id }, cookie(de));

    // 10 places : la 11e est refusée.
    for (let k = 1; k <= 10; k++) assert.strictEqual((await suivre('E0', `E${k}`)).status, 303);
    const trop = await suivre('E0', 'E11');
    assert.match(trop.headers.get('location'), /erreur=.*10%20personnes/);
    assert.strictEqual((await m.poster('/communaute/ne-plus-suivre', { id: 'E10' }, cookie('E0'))).status, 303);

    // Défi : E0 invite E11 (place 10/10), E11 accepte ; ils se suivent, comme concurrents.
    await m.poster('/communaute/defier', { id: 'E11' }, cookie('E0'));
    assert.match((await (await m.get('/communaute', cookie('E11'))).text()), /Invitations à concourir[\s\S]*p_E0|Invitations à concourir[\s\S]*E0/);
    assert.ok(appels.some(([nom, c]) => nom === 'invitationConcurrence' && c.vers === 'E11'));
    const cid = m.db.prepare("SELECT id FROM concurrences WHERE de = 'E0'").get().id;
    assert.strictEqual(m.db.prepare('SELECT objectif FROM concurrences WHERE id = ?').get(cid).objectif, 1000, 'premier palier : 1 000 $');
    await m.poster(`/communaute/concurrences/${cid}`, { reponse: 'oui' }, cookie('E11'));
    assert.deepStrictEqual(m.db.prepare("SELECT suiveur, type FROM suivis WHERE (suiveur = 'E0' AND suivi = 'E11') OR (suiveur = 'E11' AND suivi = 'E0') ORDER BY suiveur").all().map((x) => `${x.suiveur}:${x.type}`), ['E0:concurrent', 'E11:concurrent']);
    assert.match((await m.poster('/communaute/ne-plus-suivre', { id: 'E11' }, cookie('E0'))).headers.get('location'), /erreur=.*concurrent/);
    // Pas encore à l'étape 4 : pas de concurrence.
    assert.match((await m.poster('/communaute/defier', { id: 'E5' }, cookie('N'))).headers.get('location') || '', /erreur|parcours/);

    // Le coach valide un compte rendu de E11 qui dépasse 1 000 $ : ceux qui le suivent sont prévenus, il gagne la concurrence.
    const crId = compteRendu(m, 'E11', jourIl(1), { etat: 'attente', total: 1200, vues: 45000 });
    await m.poster(`/admin/comptes-rendus/${crId}/decision`, { decision: 'valider' }, { cookie: cookieSession(ADMIN, 'coach') });
    const partage = appels.find(([nom]) => nom === 'resultatPartage');
    assert.ok(partage, 'résultat partagé');
    assert.strictEqual(partage[1].nom, 'p_E11', 'jamais le nom complet');
    assert.strictEqual(partage[2].type, 'gain');
    assert.ok(partage[2].valeur > 0);
    assert.deepStrictEqual(partage[3].map((s) => s.suiveur), ['E0']);
    assert.ok(appels.some(([nom, c, g]) => nom === 'concurrenceGagnee' && c.id === cid && g.id === 'E11'));
    assert.strictEqual(m.db.prepare('SELECT statut, gagnant FROM concurrences WHERE id = ?').get(cid).gagnant, 'E11');

    // Mon profil : la roue des jours, la chaîne, « Je suis », la barre du bas ; c'est l'accueil de l'élève.
    const profil = await (await m.get('/profil', cookie('E0'))).text();
    assert.match(profil, /class="roue-jour aujourdhui"/);
    assert.match(profil, /Je suis[\s\S]*10 \/ 10/);
    assert.match(profil, /class="barre-bas"[\s\S]*Profil[\s\S]*Remarques[\s\S]*Mes rappels[\s\S]*Classement/);
    assert.doesNotMatch(profil, /Nom-complet/);
    assert.strictEqual((await m.get('/remarques', cookie('E0'))).status, 200);
  } finally { await m.fermer(); }
});
