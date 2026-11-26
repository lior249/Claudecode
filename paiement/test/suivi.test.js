'use strict';

// Livraison 2 de l'accompagnement Elite : étape 4 (publication et suivi), comptes rendus, objectifs,
// GOAT et rôles de revenus, rappels quotidiens, absences et sinistrés.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { creerBob } = require('../src/bob');
const { jourLisible } = require('../src/suivi');

const E1 = '700000000000000011';
const E2 = '700000000000000012';
const JOUR = 24 * 3600 * 1000;
const attendre = () => new Promise((r) => setTimeout(r, 30));
const urls = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.url));
const idsBoutons = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.custom_id)).filter(Boolean);
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const jourIso = (d) => d.toISOString().slice(0, 10);

// Application de test + Bob réel (messages et rôles capturés).
async function monterAvecBob(options = {}) {
  const holder = {};
  const m = await monter({ ...options, bob: { get parcours() { return holder.bob && holder.bob.parcours; } } });
  const dms = [];
  const roles = new Map();
  const membreFaux = (id) => {
    if (!roles.has(id)) roles.set(id, new Set());
    const set = roles.get(id);
    return { id, roles: { cache: set, add: async (r) => set.add(r), remove: async (r) => set.delete(r) } };
  };
  holder.bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures,
    parcours: m.parcours, suivi: m.suivi, sinistres: m.sinistres, maintenant: options.maintenant,
    serveur: { members: { fetch: async (id) => membreFaux(id) } },
    client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
  return { m, dms, roles, bob: holder.bob };
}
async function image(m, cookie) {
  const r = await fetch(`${m.base}/api/parcours/image`, { method: 'POST', headers: { 'Content-Type': 'image/png', cookie }, body: PNG });
  return { statut: r.status, ...(await r.json()) };
}
function statsVideos(pubs, revenus) {
  const champs = {};
  for (const p of pubs) {
    Object.assign(champs, { [`v_${p.id}_vues`]: '4000', [`v_${p.id}_abonnes`]: '17', [`v_${p.id}_heure`]: '10:00',
      [`v_${p.id}_visionnage_s`]: '8', [`v_${p.id}_retention_10s`]: '42.5', [`v_${p.id}_revenus`]: String(revenus) });
  }
  return champs;
}

test('étape 4 : heures, déclaration, compte rendu, décision du coach, objectifs, GOAT et rôles de revenus', async () => {
  const { m, dms, roles, bob } = await monterAvecBob();
  try {
    const membre = cookieSession(E1, 'awa_27');
    const coach = cookieSession(ADMIN, 'overmaxx');
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);

    // Les 3 heures d'abord (délai de 12 h).
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Choisis tes 3 heures/);
    assert.match(await (await m.get('/parcours/etape-4', { cookie: membre })).text(), /Création de ta vidéo/);
    assert.strictEqual((await m.poster('/parcours/etape-4/heures', { creation: '9h', publication: '10:00', compte_rendu: '10:00', fuseau: 'Africa/Lome' }, { cookie: membre })).status, 400);
    const h = await m.poster('/parcours/etape-4/heures', { creation: '09:00', publication: '10:00', compte_rendu: '10:00', fuseau: 'Africa/Lome' }, { cookie: membre });
    assert.strictEqual(h.headers.get('location'), '/parcours/etape-4?ok=heures');
    assert.strictEqual(m.parcours.get(E1).fuseau, 'Africa/Lome');
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Publie ta vidéo du jour/);

    // Capture du compte : envoyée par le membre, visible par lui et par le coach seulement.
    const img = await image(m, membre);
    assert.match(img.nom, /^[a-f0-9]{24}\.png$/);
    assert.strictEqual((await image(m, cookieSession('AUTRE', 'x'))).statut, 401);
    m.parcours.assurer(E2, { pseudo: 'kodjo' });
    m.parcours.changerEtape(E2, 4);
    m.suivi.choisirHeures(E2, { creation: '09:00', publication: '10:00', compteRendu: '10:00', fuseau: 'Africa/Lome' });
    const img2 = await image(m, cookieSession(E2, 'kodjo'));
    assert.strictEqual((await m.get(`/fichiers/images/${img.nom}`, { cookie: membre })).status, 200);
    assert.strictEqual((await m.get(`/fichiers/images/${img.nom}`, { cookie: coach })).status, 200);
    assert.strictEqual((await m.get(`/fichiers/images/${img.nom}`, { cookie: cookieSession(E2, 'kodjo') })).status, 403);

    // Déclaration du jour : liens TikTok + capture du membre lui-même.
    const lien1 = 'https://www.tiktok.com/@awa/video/7400000000000000001';
    const lien2 = 'https://www.tiktok.com/@awa/video/7400000000000000002';
    void img2;
    const pasTiktok = await m.poster('/parcours/etape-4/publication', { liens: 'https://youtube.com/watch?v=1', capture: img.nom }, { cookie: membre });
    assert.strictEqual(pasTiktok.status, 400);
    assert.match(await pasTiktok.text(), /pas un lien TikTok/);
    const decl = await m.poster('/parcours/etape-4/publication', { liens: `${lien1}\n${lien2}`, capture: img.nom }, { cookie: membre });
    assert.strictEqual(decl.headers.get('location'), '/parcours/etape-4?ok=publication');
    assert.match(await (await m.get('/parcours/etape-4', { cookie: membre })).text(), /2 vidéo\(s\) déclarée\(s\)/);
    // Une vidéo ne se déclare qu'une fois (même avec des ?paramètres en plus dans le lien).
    const double = await m.poster('/parcours/etape-4/publication', { liens: `${lien1}?is_from_webapp=1` }, { cookie: membre });
    assert.strictEqual(double.status, 400);
    assert.match(await double.text(), /déjà été postée/);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Ta vidéo du jour est déclarée/);

    // Le lendemain : compte rendu de la veille.
    const hier = jourIso(new Date(Date.now() - JOUR));
    m.db.prepare('UPDATE publications SET jour = ? WHERE discord_id = ?').run(hier, E1);
    m.db.prepare('UPDATE captures_jour SET jour = ? WHERE discord_id = ?').run(hier, E1);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), new RegExp(`Envoie ton compte rendu du ${jourLisible(hier)}`));
    const pubs = m.suivi.publications(E1, hier);
    assert.strictEqual(pubs.length, 2);
    const avantHier = jourIso(new Date(Date.now() - 2 * JOUR));
    const memeMois = avantHier.slice(0, 7) === hier.slice(0, 7);
    m.db.prepare('INSERT INTO publications (discord_id, jour, lien, cree_le) VALUES (?, ?, ?, ?)').run(E1, avantHier, 'https://www.tiktok.com/@awa/video/3', new Date().toISOString());
    const pub3 = m.suivi.publications(E1, avantHier)[0];
    const cr0 = m.suivi.enregistrerCompteRendu(E1, avantHier, { total_mois: '$100.00', abonnes_total: 900, vues_total: 30000, abonnes_jour: 50, vues_jour: 20000,
      pays_vues: ['France'], pays_abonnes: ['France'], capture_revenus: img.nom, videos: { [pub3.id]: { vues: 20000, abonnes: 50, heure: '10:00', visionnage_s: 9, retention_10s: 55, revenus: 80 } } });
    assert.ok(cr0.compteRendu, JSON.stringify(cr0));
    m.suivi.decider(cr0.compteRendu.id, 'valider');
    assert.strictEqual(m.suivi.stats(E1).revenusTotal, 100);
    assert.deepStrictEqual(m.suivi.stats(E1).objectifs.map((o) => o.atteint), [true, false, false, false]);
    const formulaire = await (await m.get(`/parcours/compte-rendu/${hier}`, { cookie: membre })).text();
    assert.match(formulaire, /Tes récompenses TikTok/);
    assert.match(formulaire, memeMois ? /Ton dernier total de .*\$100\.00/ : /Premier compte rendu de/);
    const compte = { abonnes_total: '1200', vues_total: '54000', abonnes_jour: '35', vues_jour: '8000', pays_vues_1: 'France', pays_abonnes_1: 'Côte d\'Ivoire',
      capture_revenus: img.nom, question: 'autre', question_autre: 'Comment garder mes viewers après 10 s ?' };
    const sansTotal = await m.poster(`/parcours/compte-rendu/${hier}`, { ...compte, ...statsVideos(pubs, 300) }, { cookie: membre });
    assert.strictEqual(sansTotal.status, 400);
    assert.match(await sansTotal.text(), /Recopie le total de/);
    compte.total_mois = '$600.00';
    const incomplet = await m.poster(`/parcours/compte-rendu/${hier}`, compte, { cookie: membre });
    assert.strictEqual(incomplet.status, 400);
    const texteIncomplet = await incomplet.text();
    assert.match(texteIncomplet, /Remplis toutes les statistiques/);
    assert.match(texteIncomplet, /value="54000"/, 'ce qu\'il a tapé est gardé');
    const envoi = await m.poster(`/parcours/compte-rendu/${hier}`, { ...compte, ...statsVideos(pubs, 300) }, { cookie: membre });
    assert.strictEqual(envoi.headers.get('location'), '/parcours/etape-4?ok=compte-rendu');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && t.includes(`compte rendu du ${jourLisible(hier)}`)));

    // Coach : À traiter, page du compte rendu, demande de modifications.
    assert.match(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), new RegExp(`Compte rendu du ${jourLisible(hier)}`));
    const cr = m.suivi.compteRendu(E1, hier);
    const pageCoach = await (await m.get(`/admin/comptes-rendus/${cr.id}`, { cookie: coach })).text();
    assert.match(pageCoach, /Comment garder mes viewers/);
    assert.match(pageCoach, memeMois ? /\$600\.00 − \$100\.00/ : /Premier compte rendu de/);
    assert.ok(pageCoach.includes(`/fichiers/images/${img.nom}`));
    assert.strictEqual((await m.get(`/admin/comptes-rendus/${cr.id}`, { cookie: membre })).status, 403);
    assert.match((await m.poster(`/admin/comptes-rendus/${cr.id}/decision`, { decision: 'corriger' }, { cookie: coach })).headers.get('location'), /erreur=/);
    await m.poster(`/admin/comptes-rendus/${cr.id}/decision`, { decision: 'corriger', texte: 'La rétention de la vidéo 2 est fausse : regarde la capture.' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /demande des modifications sur ton compte rendu/.test(t)));
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Corrige ton compte rendu/);
    const aCorriger = await (await m.get(`/parcours/compte-rendu/${hier}`, { cookie: membre })).text();
    assert.match(aCorriger, /La rétention de la vidéo 2 est fausse/);
    assert.match(aCorriger, /value="1200"/);
    assert.strictEqual((await m.poster(`/parcours/compte-rendu/${hier}`, { ...compte, total_mois: '1 600,00', capture_revenus: '', ...statsVideos(pubs, 300) }, { cookie: membre })).status, 303, 'capture déjà reçue');
    assert.strictEqual(m.suivi.compteRendu(E1, hier).total_mois, 1600);
    assert.strictEqual(m.suivi.compteRendu(E1, hier).etat, 'attente');

    await m.poster(`/admin/comptes-rendus/${cr.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /compte rendu du .* est validé/.test(t)));
    const st = m.suivi.stats(E1);
    assert.strictEqual(st.revenusTotal, memeMois ? 1600 : 1700);
    assert.deepStrictEqual(m.suivi.gains(E1, { valides: true }).map((g) => g.gain), [100, memeMois ? 1500 : 1600]);
    assert.deepStrictEqual(st.objectifs.map((o) => o.atteint), [true, true, true, true]);
    assert.match(await (await m.get(`/parcours/compte-rendu/${hier}`, { cookie: membre })).text(), /est validé/);
    assert.strictEqual((await m.get('/fiche', { cookie: membre })).status, 200);

    // Mon profil : le tableau de bord (données jour par jour), visible par le membre et par le coach.
    const profil = await (await m.get('/revenus', { cookie: membre })).text(); // le tableau de bord, ouvert depuis Mon profil
    assert.match(profil, /Récompenses estimées/);
    assert.ok(profil.includes(`&quot;j&quot;:&quot;${hier}&quot;`), 'données du tableau de bord');
    assert.strictEqual((await m.get(`/admin/membres/${E1}/profil`, { cookie: coach })).status, 200);
    assert.strictEqual((await m.get(`/admin/membres/${E1}/profil`, { cookie: membre })).status, 403);
    const alertes = dms.filter(([id, , c]) => id === ADMIN && idsBoutons(c).length);
    assert.deepStrictEqual(alertes.flatMap(([, , c]) => idsBoutons(c)).sort(), [`recompense:1500:${E1}`, `recompense:goat:${E1}`]);
    assert.match(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), /Rôle GOAT à confirmer/);

    // 1 500 € confirmé depuis Discord, GOAT depuis la plateforme : Bob donne les rôles.
    const inter = { user: { id: ADMIN }, isButton: () => true, customId: `recompense:1500:${E1}`, message: { content: 'Seuil atteint.' },
      update: async (d) => { inter.maj = d; }, reply: async (d) => { inter.rep = d; } };
    await bob.surInteraction(inter);
    assert.match(inter.maj.content, /Confirmé/);
    assert.ok(roles.get(E1).has(m.config.discord.rolesRevenus[1500]));
    const goat = await m.poster(`/admin/membres/${E1}/recompense`, { role: 'goat' }, { cookie: coach });
    assert.match(goat.headers.get('location'), /fait=recompense/);
    await attendre();
    assert.strictEqual(m.parcours.get(E1).etape, 5);
    assert.ok(roles.get(E1).has(m.config.discord.roleGoat));
    assert.ok(dms.some(([id, t]) => id === E1 && /Tu es GOAT/.test(t)));
    assert.match((await m.poster(`/admin/membres/${E1}/recompense`, { role: 'goat' }, { cookie: coach })).headers.get('location'), /erreur=/, 'déjà confirmé');
  } finally { await m.fermer(); }
});

test('rappels quotidiens à l\'heure du membre (création, publication, compte rendu) et délai des heures', async () => {
  let now = new Date('2026-12-01T08:00:00Z');
  const { m, dms, bob } = await monterAvecBob({ maintenant: () => now });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const vers = () => dms.filter(([id]) => id === E1);
    now = new Date('2026-12-01T13:00:00Z'); await bob.relancerParcours();
    assert.strictEqual(vers().length, 0, 'pas avant 6 h');
    now = new Date('2026-12-01T14:01:00Z'); await bob.relancerParcours(); await bob.relancerParcours();
    assert.strictEqual(vers().length, 1);
    assert.match(vers()[0][1], /Choisis tes 3 heures/);

    // New York (UTC-5 en décembre) : 9 h, 10 h et 11 h, heure locale.
    m.suivi.choisirHeures(E1, { creation: '09:00', publication: '10:00', compteRendu: '11:00', fuseau: 'America/New_York' });
    now = new Date('2026-12-02T13:50:00Z'); await bob.rappelsQuotidiens();
    assert.strictEqual(vers().length, 1, '8 h 50 à New York : rien');
    now = new Date('2026-12-02T14:10:00Z'); await bob.rappelsQuotidiens(); await bob.rappelsQuotidiens();
    assert.strictEqual(vers().length, 2);
    assert.match(vers()[1][1], /créer ta vidéo du jour/);
    now = new Date('2026-12-02T15:05:00Z'); await bob.rappelsQuotidiens();
    assert.match(vers()[2][1], /heure de publier/);
    m.suivi.declarer(E1, { liens: ['https://www.tiktok.com/@awa/video/1'], capture: 'capture.png' });
    assert.strictEqual(m.suivi.publications(E1, '2026-12-02').length, 1, 'déclarée le 2 décembre, heure de New York');
    now = new Date('2026-12-02T16:05:00Z'); await bob.rappelsQuotidiens();
    assert.strictEqual(vers().length, 3, 'rien à rendre : pas de rappel de compte rendu');

    // Le lendemain : déjà publié ? non → rappel de publication ; compte rendu de la veille à faire → bouton vers lui.
    now = new Date('2026-12-03T16:05:00Z'); await bob.rappelsQuotidiens();
    const cr = vers().find(([, t]) => /heure de ton compte rendu/.test(t));
    assert.ok(cr, 'rappel du compte rendu');
    assert.ok(urls(cr[2])[0].includes('compte-rendu%2F2026-12-02'));

    // Sinistré : plus de rappels quotidiens.
    const n = vers().length;
    m.sinistres.ouvrir(E1);
    now = new Date('2026-12-04T14:10:00Z'); await bob.rappelsQuotidiens();
    assert.strictEqual(vers().length, n);
  } finally { await m.fermer(); }
});

test('sinistrés : absences (3, 6, 7 jours), rôles, fiche, précisions, réhabilitation et force majeure', async () => {
  let now = new Date('2026-12-01T10:00:00Z');
  const { m, dms, roles, bob } = await monterAvecBob({ maintenant: () => now });
  try {
    const membre = cookieSession(E1, 'awa_27');
    const coach = cookieSession(ADMIN, 'overmaxx');
    const elite = m.config.offres.elite.roleDiscord;
    const sinistre = m.config.discord.roleSinistre;
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 3);
    roles.set(E1, new Set([elite]));
    const vers = () => dms.filter(([id]) => id === E1).map(([, t]) => t);
    const plus = (jours, minutes = 1) => new Date(Date.parse('2026-12-01T10:00:00Z') + jours * JOUR + minutes * 60000);

    // Mise en service : le compteur d'absence part de maintenant.
    await bob.surveillerAbsences();
    assert.ok(m.parcours.get(E1).derniere_activite);
    now = plus(2); await bob.surveillerAbsences();
    assert.strictEqual(vers().length, 0);
    now = plus(3); await bob.surveillerAbsences(); await bob.surveillerAbsences();
    assert.strictEqual(vers().length, 1);
    assert.match(vers()[0], /Pourquoi tu n'es pas là/);
    now = plus(6); await bob.surveillerAbsences();
    assert.match(vers()[1], /Demain, tu seras sinistré/);

    // 7 jours : sinistre 1 / 3, rôle Elite retiré, rôle Sinistré donné.
    now = plus(7); await bob.surveillerAbsences();
    let p = m.parcours.get(E1);
    assert.strictEqual(p.sinistres, 1);
    assert.ok(p.sinistre_depuis);
    assert.match(vers()[2], /Tu es sinistré \(1 \/ 3\)/);
    assert.ok(dms.some(([id, t]) => id === ADMIN && /est \*\*sinistré \(1 \/ 3\)\*\*/.test(t)));
    assert.ok(roles.get(E1).has(sinistre) && !roles.get(E1).has(elite));

    // Sur la plateforme : seulement sa fiche de sinistre (et Ma fiche) ; pas de coaching.
    assert.strictEqual((await m.get('/parcours', { cookie: membre })).headers.get('location'), '/sinistre');
    assert.strictEqual((await m.get('/parcours/etape-3', { cookie: membre })).headers.get('location'), '/sinistre');
    assert.match(await (await m.get('/sinistre', { cookie: membre })).text(), /Tu es sinistré/);
    assert.strictEqual((await m.get('/fiche', { cookie: membre })).status, 200);
    assert.match(await (await m.get('/coaching', { cookie: membre })).text(), /Tu es sinistré/);
    const api = await fetch(`${m.base}/api/parcours/envoi`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre }, body: '{"emplacement":"V1"}' });
    assert.strictEqual(api.status, 403);

    // Fiche pas remplie : rappel toutes les 24 h ; 7 jours de plus : sinistre 2, puis 3 (sinistré total).
    now = plus(8, 5); await bob.surveillerAbsences();
    assert.match(vers().at(-1), /remplis ta fiche de sinistre/);
    const depuis = Date.parse(m.parcours.get(E1).sinistre_depuis);
    now = new Date(depuis + 7 * JOUR + 60000); await bob.surveillerAbsences();
    assert.strictEqual(m.parcours.get(E1).sinistres, 2);
    assert.ok(vers().some((t) => /sinistre 2 \/ 3/.test(t)));
    now = new Date(depuis + 14 * JOUR + 60000); await bob.surveillerAbsences();
    p = m.parcours.get(E1);
    assert.strictEqual(p.sinistres, 3);
    assert.strictEqual(p.sinistre_total, 1);
    assert.ok(vers().some((t) => /sinistre 3 \/ 3.*Sinistré total/.test(t)));

    // La fiche : trop courte, puis complète ; le coach est prévenu.
    assert.strictEqual((await m.poster('/sinistre', { pourquoi: 'malade', engagements: 'revenir' }, { cookie: membre })).status, 400);
    const fiche = { pourquoi: 'J\'ai perdu mon téléphone et je n\'avais plus accès à mon compte.', engagements: 'Je publie chaque jour à 10 h et je préviens si j\'ai un souci.' };
    assert.strictEqual((await m.poster('/sinistre', fiche, { cookie: membre })).headers.get('location'), '/sinistre');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && /a rempli sa \*\*fiche de sinistre\*\*/.test(t)));
    assert.match(await (await m.get('/sinistre', { cookie: membre })).text(), /Ta fiche est envoyée/);
    assert.match(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), /Fiche de sinistre \(3 \/ 3\)/);

    // Précisions : un texte obligatoire, visible par le membre.
    assert.match((await m.poster(`/admin/membres/${E1}/sinistre`, { action: 'precisions' }, { cookie: coach })).headers.get('location'), /erreur=/);
    assert.match((await m.poster(`/admin/membres/${E1}/sinistre`, { action: 'precisions', texte: 'Donne des dates précises.' }, { cookie: coach })).headers.get('location'), /fait=precisions/);
    await attendre();
    assert.ok(vers().some((t) => /demande des précisions/.test(t)));
    const precisions = await (await m.get('/sinistre', { cookie: membre })).text();
    assert.match(precisions, /Donne des dates précises/);
    assert.match(precisions, /Envoyer ma fiche/);
    await m.poster('/sinistre', { ...fiche, pourquoi: `${fiche.pourquoi} Du 1er au 20 décembre.` }, { cookie: membre });

    // Réhabilité : rôle Elite rendu ; sinistré total, donc toujours pas de live individuel.
    assert.match((await m.poster(`/admin/membres/${E1}/sinistre`, { action: 'rehabiliter' }, { cookie: coach })).headers.get('location'), /fait=rehabiliter/);
    await attendre();
    assert.ok(roles.get(E1).has(elite) && !roles.get(E1).has(sinistre));
    assert.ok(vers().some((t) => /Tu es réhabilité/.test(t)));
    assert.strictEqual((await m.get('/parcours', { cookie: membre })).status, 200);
    assert.match(await (await m.get('/coaching', { cookie: membre })).text(), /Sinistré total/);

    // Force majeure : compteur à 0, lives rendus, jours d'absence ajoutés aux 90 jours.
    const finAvant = m.parcours.get(E1).fin_le;
    const jours = m.sinistres.joursAbsence(E1);
    assert.ok(jours >= 20, `${jours} jours d'absence`);
    await m.poster(`/admin/membres/${E1}/sinistre`, { action: 'retirer' }, { cookie: coach });
    await attendre();
    p = m.parcours.get(E1);
    assert.strictEqual(p.sinistres, 0);
    assert.strictEqual(p.sinistre_total, 0);
    assert.strictEqual(Math.round((Date.parse(p.fin_le) - Date.parse(finAvant)) / JOUR), jours);
    assert.ok(vers().some((t) => /sinistres sont retirés/.test(t)));
  } finally { await m.fermer(); }
});

test('sinistrés : les jours où le membre attend son coach ne comptent pas', async () => {
  let now = new Date('2026-12-01T10:00:00Z');
  const { m, dms, bob } = await monterAvecBob({ maintenant: () => now });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    for (const e of ['L1', 'L2']) {
      const r = m.parcours.preparerEnvoi(E1, e, { note: 85, retour: 'Retour complet de l\'IA sur la vidéo.' });
      m.db.prepare("UPDATE soumissions SET etat = 'attente', envoye_le = ? WHERE id = ?").run(now.toISOString(), r.soumission.id);
    }
    assert.strictEqual(m.parcours.tache(E1).cle, 'attente1');
    for (const j of [1, 4, 8, 12]) { now = new Date(Date.parse('2026-12-01T10:00:00Z') + j * JOUR); await bob.surveillerAbsences(); }
    assert.strictEqual(dms.filter(([id]) => id === E1).length, 0);
    assert.strictEqual(m.parcours.get(E1).sinistres, 0);
  } finally { await m.fermer(); }
});
