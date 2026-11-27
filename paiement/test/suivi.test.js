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
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();

    // Le lien du compte TikTok d'abord : obligatoire à l'étape 4 (plus à l'étape 3).
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Ajoute le lien de ton compte TikTok/);
    assert.strictEqual((await m.poster('/parcours/etape-4/publication', { liens: 'https://www.tiktok.com/@awa/video/1' }, { cookie: membre })).headers.get('location'), '/parcours/etape-4#compte');
    assert.strictEqual((await m.poster('/parcours/etape-4/compte', { compte: 'pas un lien !' }, { cookie: membre })).status, 400);
    assert.strictEqual((await m.poster('/parcours/etape-4/compte', { compte: 'https://www.tiktok.com/@awa?lang=fr' }, { cookie: membre })).headers.get('location'), '/parcours/etape-4?ok=compte');
    assert.strictEqual(m.parcours.get(E1).compte_tiktok, 'https://www.tiktok.com/@awa');
    // Déjà monétisé (déjà passé par les 10K) : revenus et RPM demandés dans les résultats et l'update.
    m.db.prepare("UPDATE parcours SET monetisation_etat = 'acceptee', monetisation_le = ? WHERE discord_id = ?").run(new Date(Date.now() - 864e5 * 10).toISOString(), E1);

    // Puis les 3 heures (délai de 12 h).
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
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
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
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Ta vidéo du jour est déclarée|Fais l.{1,6}update de ton compte/);

    // 24 h après : les résultats de chaque vidéo (capture, vues, revenus), puis le coach valide.
    const hier = jourIso(new Date(Date.now() - JOUR));
    m.db.prepare('UPDATE publications SET jour = ?, cree_le = ? WHERE discord_id = ?').run(hier, new Date(Date.now() - 25 * 3600000).toISOString(), E1);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), new RegExp(`Donne les résultats de ta vidéo du ${jourLisible(hier)}`));
    const [v1, v2] = m.suivi.videos(E1).reverse();
    assert.match(await (await m.get(`/parcours/videos/${v1.id}`, { cookie: membre })).text(), /Capture des résultats de la vidéo/);
    const sansCapture = await m.poster(`/parcours/videos/${v1.id}`, { vues: '4000', abonnes: '40', revenus: '300', rpm: '1.2' }, { cookie: membre });
    assert.strictEqual(sansCapture.status, 400);
    assert.match(await sansCapture.text(), /Ajoute la capture/);
    const r1 = await m.poster(`/parcours/videos/${v1.id}`, { vues: '4000', abonnes: '40', revenus: '$300.00', rpm: '1.20', capture: img.nom }, { cookie: membre });
    assert.strictEqual(r1.headers.get('location'), '/parcours/etape-4?ok=resultat');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && /résultats de sa vidéo/.test(t)));
    assert.strictEqual((await m.poster(`/parcours/videos/${v2.id}`, { vues: '1', abonnes: '0', revenus: '0', rpm: '0', capture: img2.nom }, { cookie: membre })).status, 400, 'capture d\'un autre membre refusée');
    // Trop tôt : une vidéo publiée à l'instant.
    await m.poster('/parcours/etape-4/publication', { liens: 'https://www.tiktok.com/@awa/video/7400000000000000003' }, { cookie: membre });
    const v3 = m.suivi.videos(E1)[0];
    assert.match(await (await m.poster(`/parcours/videos/${v3.id}`, { vues: '1', abonnes: '0', revenus: '0', rpm: '0', capture: img.nom }, { cookie: membre })).text(), /24 h après la publication/);

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
    await m.poster(`/parcours/videos/${v1.id}`, { vues: '5000', abonnes: '50', revenus: '300', rpm: '1.2', capture: img3.nom }, { cookie: membre });
    assert.strictEqual(m.suivi.video(v1.id).captures.length, 2, 'la capture s\'ajoute aux précédentes');
    await m.poster(`/admin/resultats/${v1.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await m.poster(`/parcours/videos/${v2.id}`, { vues: '20000', abonnes: '900', revenus: '1300', rpm: '1.5', capture: img.nom }, { cookie: membre });
    await m.poster(`/admin/resultats/${v2.id}/decision`, { decision: 'valider' }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /résultats de ta vidéo du .* sont validés/.test(t)));
    const st = m.suivi.stats(E1);
    assert.strictEqual(st.revenusTotal, 0, 'les revenus viennent des updates du compte, pas des vidéos');

    // Update du compte du jour : capture des 28 derniers jours, vues et revenus ; il sert pour GOAT (28 jours).
    const aujourdhui = m.suivi.aujourdhui(m.parcours.get(E1));
    assert.match(await (await m.get(`/parcours/compte-rendu/${aujourdhui}`, { cookie: membre })).text(), /28 derniers jours/);
    const sansRevenus = await m.poster(`/parcours/compte-rendu/${aujourdhui}`, { abonnes: '12000', vues_28j: '54000', capture: img.nom }, { cookie: membre });
    assert.strictEqual(sansRevenus.status, 400);
    assert.match(await sansRevenus.text(), /revenus sur les 28 derniers jours/);
    const up = await m.poster(`/parcours/compte-rendu/${aujourdhui}`, { abonnes: '12000', vues_28j: '54000', revenus_28j: '1 600,00', capture: img.nom, question: 'Comment garder mes viewers après 10 s ?' }, { cookie: membre });
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
    // Objectifs dans l'ordre : vues et abonnés d'abord, puis les revenus ($50 à $10 000).
    const objectifs = m.suivi.stats(E1).objectifs;
    assert.deepStrictEqual(objectifs.map((o) => o.libelle).slice(0, 7), ['10 000 vues', '1 000 abonnés', '100 000 vues', '5 000 abonnés', '10 000 abonnés', '1 000 000 vues', '$50']);
    assert.deepStrictEqual(objectifs.filter((o) => o.type === 'revenus').map((o) => o.atteint), [true, true, true, true, true, false, false]);
    assert.ok(objectifs[0].atteint, '54 000 vues : 10K vues atteint');
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
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    m.parcours.majCompte(E1, { compte: '@awa_27' });
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

test('étape 4 : faire relire une vidéo avant de publier (facultatif, 3 en attente au plus), avec remarque et script ; le coach est prévenu de tout', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const page = await (await m.get('/parcours/etape-4', membre)).text();
    assert.match(page, /Progresser[\s\S]*Améliorer ton hook[\s\S]*Regarder la leçon[\s\S]*\+ Ajouter une remarque[\s\S]*\+ Coller le script de la vidéo/);
    const envoyer = async (corps) => fetch(`${m.base}/api/parcours/envoi`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre.cookie }, body: JSON.stringify(corps) });
    const video = async (id) => fetch(`${m.base}/api/parcours/envoi/${id}/video`, { method: 'POST', headers: { 'Content-Type': 'video/mp4', cookie: membre.cookie }, body: Buffer.from('0000') });
    const ids = [];
    for (let k = 0; k < 3; k++) {
      const r = await (await envoyer({ emplacement: 'avis', remarque: `Ma remarque ${k}`, script: k === 0 ? 'Le script de ma vidéo.' : '', axe: k === 0 ? 'hook' : undefined })).json();
      assert.ok(r.id, JSON.stringify(r));
      assert.strictEqual((await video(r.id)).status, 200);
      ids.push(r.id);
    }
    assert.deepStrictEqual(m.parcours.soumissions(E1, 4).map((s) => s.emplacement).sort(), ['R1', 'R2', 'R3']);
    assert.strictEqual(m.parcours.soumission(ids[0]).axe, 'hook', 'la vidéo du point « hook »');
    // « J'ai regardé » : la leçon est cochée.
    await m.poster('/parcours/etape-4/tuto', { axe: 'hook' }, membre);
    assert.deepStrictEqual(JSON.parse(m.parcours.get(E1).tutos_vus), ['hook']);
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Améliorer ton hook<\/h3><span class="etat" data-etat="valide">/);
    const quatre = await envoyer({ emplacement: 'avis' });
    assert.strictEqual(quatre.status, 400);
    assert.match((await quatre.json()).erreur, /déjà 3 vidéos en attente/);
    // Le coach : dans À traiter, avec la remarque et le script ; « Prête à publier » ou « À retravailler » (sans délai).
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /data-filtre="avis"[\s\S]*Vidéo à relire avant publication · script joint/);
    const envoi = await (await m.get(`/admin/envois/${ids[0]}`, coach)).text();
    assert.match(envoi, /Sa remarque[\s\S]*Ma remarque 0[\s\S]*Script de la vidéo[\s\S]*Le script de ma vidéo/);
    assert.match(envoi, /À retravailler[\s\S]*Prête à publier/);
    await m.poster(`/admin/envois/${ids[0]}/decision`, { decision: 'corriger', texte: 'Accroche trop longue.' }, coach);
    const s = m.parcours.soumission(ids[0]);
    assert.strictEqual(s.etat, 'corriger');
    assert.strictEqual(s.corriger_avant, null, 'pas de délai à l\'étape 4');
    assert.strictEqual(m.parcours.get(E1).etape, 4);
    // Une place s'est libérée : il peut en envoyer une autre.
    assert.ok((await (await envoyer({ emplacement: 'avis' })).json()).id);
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /À retravailler[\s\S]*Accroche trop longue/);
    // Le coach est prévenu des actions de l'élève (compte TikTok, publication).
    await m.poster('/parcours/etape-4/compte', { compte: '@awa' }, membre);
    assert.ok(appels.some(([n, , t]) => n === 'activiteEleve' && /compte TikTok/.test(t)));
    assert.ok(appels.filter(([n]) => n === 'envoiRecu').length >= 3, 'chaque vidéo envoyée');
  } finally { await m.fermer(); }
});

test('réalisations sur la fiche (coach et élève) ; étape 4 : seules les 3 dernières vidéos restent sur le serveur ; message derrière un bouton', async () => {
  const m = await monter({ bob: { parcours: new Proxy({}, { get: () => async () => true }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const envoyer = async () => {
      const r = await (await fetch(`${m.base}/api/parcours/envoi`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre.cookie }, body: JSON.stringify({ emplacement: 'avis', remarque: 'Ça passe ?' }) })).json();
      await fetch(`${m.base}/api/parcours/envoi/${r.id}/video`, { method: 'POST', headers: { 'Content-Type': 'video/mp4', cookie: membre.cookie }, body: Buffer.from('0000') });
      m.db.prepare("UPDATE soumissions SET etat = 'valide' WHERE id = ?").run(r.id);
      await new Promise((x) => setTimeout(x, 5));
      return r.id;
    };
    const ids = [];
    for (let k = 0; k < 4; k++) ids.push(await envoyer());
    const fichiers = m.parcours.soumissions(E1, 4).filter((s) => s.fichier).map((s) => s.id).sort();
    assert.deepStrictEqual(fichiers, ids.slice(1).sort(), 'la plus ancienne vidéo est effacée');
    const fiche = await (await m.get(`/admin/membres/${E1}`, coach)).text();
    assert.match(fiche, /<details class="pl-ecrire" id="remarque"><summary[^>]*>✉️ Envoyer un message<\/summary>/, 'formulaire derrière un bouton');
    assert.match(fiche, /Réalisations[\s\S]*4 vidéo\(s\)[\s\S]*\/admin\/envois\/\d+\/video[\s\S]*Ça passe \?/);
    assert.match(await (await m.get('/fiche', membre)).text(), /Réalisations[\s\S]*\/parcours\/envois\/\d+\/video/);
    assert.strictEqual((await m.get(`/parcours/envois/${ids[3]}/video`, membre)).status, 200);
    assert.strictEqual((await m.get(`/parcours/envois/${ids[3]}/video`, { cookie: cookieSession('AUTRE', 'x') })).status, 404);
  } finally { await m.fermer(); }
});

test('étape 4 : sans revenus avant les 10K ; 10K → formulaire de monétisation → preuve validée ; preuves d\'audience (5 résultats) et de RPM ; rappel « revenus pas à jour »', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa' });
    m.parcours.changerEtape(E1, 4);
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE etape >= 4").run();
    m.db.prepare("UPDATE parcours SET compte_tiktok = 'https://www.tiktok.com/@awa', heure_creation = '09:00', heure_publication = '12:00', heure_compte_rendu = '00:01', fuseau = 'Africa/Lome' WHERE discord_id = ?").run(E1);
    const membre = { cookie: cookieSession(E1, 'awa') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const img = async () => (await (await fetch(`${m.base}/api/parcours/image`, { method: 'POST', headers: { 'Content-Type': 'image/png', cookie: membre.cookie }, body: png })).json()).nom;
    // Avant la monétisation : pas de champ revenus ; l'update ne demande que les abonnés et les vues.
    const jour = m.suivi.aujourdhui(m.parcours.get(E1));
    const formUp = await (await m.get(`/parcours/compte-rendu/${jour}`, membre)).text();
    assert.match(formUp, /Abonnés actuels[\s\S]*Vues \(28 jours\)[\s\S]*Après la monétisation/);
    assert.doesNotMatch(formUp, /name="revenus_28j"/);
    // 5 vidéos aux résultats validés (sans revenus) → la preuve d'audience est demandée.
    for (let k = 1; k <= 5; k++) {
      m.db.prepare("INSERT INTO publications (discord_id, jour, lien, cree_le) VALUES (?, ?, ?, ?)").run(E1, `2026-11-0${k}`, `https://www.tiktok.com/@awa/video/${k}`, new Date(Date.now() - 30 * 3600000).toISOString());
      const id = m.db.prepare('SELECT max(id) id FROM publications').get().id;
      const r = await m.poster(`/parcours/videos/${id}`, { vues: String(1000 * k), abonnes: '10', capture: await img() }, membre);
      assert.match(r.headers.get('location') || '', /ok=resultat/, 'résultats sans revenus avant la monétisation');
      await m.poster(`/admin/resultats/${id}/decision`, { decision: 'valider' }, coach);
    }
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Prouver mon audience[\s\S]*provenance dominante/);
    await m.poster('/parcours/etape-4/preuve/audience', { capture: await img() }, membre);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Preuve d.{1,6}audience à vérifier/);
    await m.poster(`/admin/membres/${E1}/preuve/audience/valider`, {}, coach);
    assert.strictEqual(m.parcours.get(E1).audience_etat, 'validee');
    // L'update du soir avec 10 200 abonnés : le formulaire de monétisation s'ouvre.
    await m.poster(`/parcours/compte-rendu/${jour}`, { abonnes: '10200', vues_28j: '250000', capture: await img() }, membre);
    assert.strictEqual(m.parcours.get(E1).monetisation_etat, 'a_faire');
    assert.ok(appels.some(([n, , t]) => n === 'messageEleve' && /10 000 abonnés/.test(t)));
    const e4 = await (await m.get('/parcours/etape-4', membre)).text();
    assert.match(e4, /10 000 abonnés[\s\S]*procédure de la formation[\s\S]*lesn_5t8uMg8rOVH8K[\s\S]*aucun message de contestation[\s\S]*Acceptée[\s\S]*Refusée/);
    assert.strictEqual((await m.poster('/parcours/etape-4/monetisation', { vue: 'oui', resultat: 'acceptee' }, membre)).status, 400, 'capture obligatoire');
    await m.poster('/parcours/etape-4/monetisation', { vue: 'oui', resultat: 'acceptee', capture: await img() }, membre);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Preuve de monétisation : candidature acceptée/);
    await m.poster(`/admin/membres/${E1}/monetisation`, { decision: 'acceptee' }, coach);
    assert.strictEqual(m.parcours.get(E1).monetisation_etat, 'acceptee');
    // Monétisé : revenus et RPM ; « pas encore à jour » → rappel à l'heure choisie.
    m.db.prepare("INSERT INTO publications (discord_id, jour, lien, cree_le) VALUES (?, '2026-11-20', 'https://www.tiktok.com/@awa/video/99', ?)").run(E1, new Date(Date.now() - 30 * 3600000).toISOString());
    const v = m.db.prepare('SELECT max(id) id FROM publications').get().id;
    assert.match(await (await m.get(`/parcours/videos/${v}`, membre)).text(), /TikTok a-t-il mis à jour tes revenus[\s\S]*RPM de la vidéo/);
    const dans1h = new Date(Date.now() + 3600000).toISOString();
    assert.strictEqual((await m.poster(`/parcours/videos/${v}`, { maj: 'non', rappel_iso: dans1h, vues: '1', abonnes: '0' }, membre)).headers.get('location'), '/parcours/etape-4?ok=rappel');
    assert.strictEqual(m.db.prepare('SELECT revenus_rappel_le r FROM publications WHERE id = ?').get(v).r, dans1h);
    assert.strictEqual((await m.poster(`/parcours/videos/${v}`, { maj: 'oui', vues: '15000', abonnes: '900', revenus: '20' }, membre)).status, 400, 'RPM obligatoire une fois monétisé');
    await m.poster(`/parcours/videos/${v}`, { maj: 'oui', vues: '15000', abonnes: '900', revenus: '20', rpm: '1.30', capture: await img() }, membre);
    assert.deepStrictEqual(Object.values(m.db.prepare('SELECT res_abonnes, res_rpm, revenus_rappel_le FROM publications WHERE id = ?').get(v)), [900, 1.3, null]);
  } finally { await m.fermer(); }
});
