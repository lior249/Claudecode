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

    // 24 h après : les résultats de chaque vidéo (capture, vues, revenus), puis le coach valide.
    const hier = jourIso(new Date(Date.now() - JOUR));
    m.db.prepare('UPDATE publications SET jour = ?, cree_le = ? WHERE discord_id = ?').run(hier, new Date(Date.now() - 25 * 3600000).toISOString(), E1);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), new RegExp(`Donne les résultats de ta vidéo du ${jourLisible(hier)}`));
    const [v1, v2] = m.suivi.videos(E1).reverse();
    assert.match(await (await m.get(`/parcours/videos/${v1.id}`, { cookie: membre })).text(), /Capture des résultats de la vidéo/);
    const sansCapture = await m.poster(`/parcours/videos/${v1.id}`, { vues: '4000', revenus: '300' }, { cookie: membre });
    assert.strictEqual(sansCapture.status, 400);
    assert.match(await sansCapture.text(), /Ajoute la capture/);
    const r1 = await m.poster(`/parcours/videos/${v1.id}`, { vues: '4000', revenus: '$300.00', capture: img.nom }, { cookie: membre });
    assert.strictEqual(r1.headers.get('location'), '/parcours/etape-4?ok=resultat');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && /résultats de sa vidéo/.test(t)));
    assert.strictEqual((await m.poster(`/parcours/videos/${v2.id}`, { vues: '1', revenus: '0', capture: img2.nom }, { cookie: membre })).status, 400, 'capture d\'un autre membre refusée');
    // Trop tôt : une vidéo publiée à l'instant.
    await m.poster('/parcours/etape-4/publication', { liens: 'https://www.tiktok.com/@awa/video/7400000000000000003' }, { cookie: membre });
    const v3 = m.suivi.videos(E1)[0];
    assert.match(await (await m.poster(`/parcours/videos/${v3.id}`, { vues: '1', revenus: '0', capture: img.nom }, { cookie: membre })).text(), /24 h après la publication/);

    // Coach : À traiter, page des résultats, modifications demandées, puis validé.
    assert.match(await (await m.get('/admin/a-traiter', { cookie: coach })).text(), new RegExp(`Résultats de la vidéo du ${jourLisible(hier)}`));
    const pageRes = await (await m.get(`/admin/resultats/${v1.id}`, { cookie: coach })).text();
    assert.ok(pageRes.includes(`/fichiers/images/${img.nom}`));
    assert.strictEqual((await m.get(`/admin/resultats/${v1.id}`, { cookie: membre })).status, 403);
    assert.match((await m.poster(`/admin/resultats/${v1.id}/decision`, { decision: 'corriger' }, { cookie: coach })).headers.get('location'), /erreur=/);
    await m.poster(`/admin/resultats/${v1.id}/decision`, { decision: 'corriger', texte: 'Les vues ne correspondent pas à la capture.' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /demande des modifications sur les résultats de ta vidéo/.test(t)));
    assert.match(await (await m.get(`/parcours/videos/${v1.id}`, { cookie: membre })).text(), /Les vues ne correspondent pas/);
    // Mise à jour : une capture de plus, nouvelles vues.
    const img3 = await image(m, membre);
    await m.poster(`/parcours/videos/${v1.id}`, { vues: '5000', revenus: '300', capture: img3.nom }, { cookie: membre });
    assert.strictEqual(m.suivi.video(v1.id).captures.length, 2, 'la capture s\'ajoute aux précédentes');
    await m.poster(`/admin/resultats/${v1.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await m.poster(`/parcours/videos/${v2.id}`, { vues: '20000', revenus: '1300', capture: img.nom }, { cookie: membre });
    await m.poster(`/admin/resultats/${v2.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /résultats de ta vidéo du .* sont validés/.test(t)));
    const st = m.suivi.stats(E1);
    assert.strictEqual(st.revenusTotal, 0, 'les revenus viennent des updates du compte, pas des vidéos');

    // Update du compte du jour : capture des 28 derniers jours, vues et revenus ; il sert pour GOAT (28 jours).
    const aujourdhui = m.suivi.aujourdhui(m.parcours.get(E1));
    assert.match(await (await m.get(`/parcours/compte-rendu/${aujourdhui}`, { cookie: membre })).text(), /28 derniers jours/);
    const sansRevenus = await m.poster(`/parcours/compte-rendu/${aujourdhui}`, { vues_28j: '54000', capture: img.nom }, { cookie: membre });
    assert.strictEqual(sansRevenus.status, 400);
    assert.match(await sansRevenus.text(), /revenus sur les 28 derniers jours/);
    const up = await m.poster(`/parcours/compte-rendu/${aujourdhui}`, { vues_28j: '54000', revenus_28j: '1 600,00', capture: img.nom, question: 'Comment garder mes viewers après 10 s ?' }, { cookie: membre });
    assert.strictEqual(up.headers.get('location'), '/parcours/etape-4?ok=compte-rendu');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && /update du compte/.test(t)));
    const cr = m.suivi.compteRendu(E1, aujourdhui);
    const pageCoach = await (await m.get(`/admin/comptes-rendus/${cr.id}`, { cookie: coach })).text();
    assert.match(pageCoach, /Comment garder mes viewers[\s\S]*|54[\s ]000/);
    await m.poster(`/admin/comptes-rendus/${cr.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /update du compte du .* est validé/.test(t)));
    assert.strictEqual(m.suivi.stats(E1).revenus28, 1600);
    assert.strictEqual(m.suivi.stats(E1).vues, 54000);
    // La première update compte entièrement : c'est la base du cumul.
    assert.strictEqual(m.suivi.stats(E1).revenusTotal, 1600);
    assert.deepStrictEqual(m.suivi.gains(E1, { valides: true }).map((g) => [g.jour, g.gain]), [[aujourdhui, 1600]]);
    assert.deepStrictEqual(m.suivi.stats(E1).objectifs.map((o) => o.atteint), [true, true, true, true]);
    assert.strictEqual((await m.get('/fiche', { cookie: membre })).status, 200);

    // Mes revenus : le tableau de bord (revenus des vidéos jour par jour), visible par le membre et par le coach.
    const profil = await (await m.get('/revenus', { cookie: membre })).text();
    assert.match(profil, /Récompenses estimées/);
    assert.ok(profil.includes(`&quot;j&quot;:&quot;${aujourdhui}&quot;`), 'données du tableau de bord');
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
    assert.strictEqual(vers().length, 4);
    assert.match(vers()[3][1], /heure de tes résultats[\s\S]*update de ton compte/, 'vidéo de moins de 24 h : seulement l\'update du compte');
    assert.ok(urls(vers()[3][2]).some((u) => u.includes('compte-rendu%2F2026-12-02')));

    // Le lendemain (vidéo de plus de 24 h) : ses résultats et l'update du compte.
    now = new Date('2026-12-03T16:05:00Z'); await bob.rappelsQuotidiens();
    const rappel = vers().find(([, t]) => /heure de tes résultats[\s\S]*résultats de ta vidéo du/.test(t));
    assert.ok(rappel, 'rappel des résultats de la vidéo');
    assert.ok(urls(rappel[2]).some((u) => u.includes('videos%2F1')));
    // Dimanche : le rappel des vidéos « bangers » à mettre à jour.
    m.db.prepare("UPDATE publications SET res_etat = 'valide', ok_vues = 10, ok_revenus = 0").run();
    m.db.prepare("INSERT INTO comptes_rendus (discord_id, jour, etat, envoye_le, cree_le) VALUES (?, '2026-12-06', 'attente', ?, ?)").run(E1, now.toISOString(), now.toISOString());
    now = new Date('2026-12-06T16:05:00Z'); await bob.rappelsQuotidiens();
    assert.match(vers().at(-1)[1], /fin de la semaine[\s\S]*bangers/);

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

test('revenus cumulés : la première update sert de base, puis la fenêtre de 28 jours glisse', async () => {
  const m = await monter();
  try {
    m.parcours.assurer('R', { pseudo: 'r' });
    m.db.prepare("UPDATE parcours SET etape = 4 WHERE discord_id = 'R'").run();
    const j = (n) => new Date(Date.parse('2026-01-01T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const up = (n, revenus, vues, etat = 'valide') => m.db.prepare('INSERT INTO comptes_rendus (discord_id, jour, etat, vues_28j, revenus_28j, envoye_le, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('R', j(n), etat, vues, revenus, new Date().toISOString(), new Date().toISOString());
    up(0, 100, 1000);   // base : 100
    up(10, 150, 1500);  // la fenêtre monte de 50 : 150
    up(28, 80, 900);    // le jour 0 est sorti : 80 + 100 = 180
    up(40, 90, 800);    // 90 + cumul au jour 12 (150) = 240
    up(41, 10, 10, 'attente');
    assert.deepStrictEqual(m.suivi.cumul('R', { valides: true }).map((x) => x.revenus), [100, 150, 180, 240]);
    assert.deepStrictEqual(m.suivi.cumul('R', { valides: true }).map((x) => x.vues), [1000, 1500, 1900, 2300]);
    assert.strictEqual(m.suivi.stats('R').revenusTotal, 240);
    assert.deepStrictEqual(m.suivi.gains('R', { valides: true }).map((g) => g.gain), [100, 50, 30, 60]);
    assert.strictEqual(m.suivi.gains('R').pop().gain, 0, 'jamais de gain négatif');
    assert.deepStrictEqual(m.suivi.periode('R', j(20)), { revenus: 90, vues: 800, updates: 2 });
  } finally { await m.fermer(); }
});
