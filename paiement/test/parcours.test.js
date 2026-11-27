'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { monter, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');
const { creerBob } = require('../src/bob');
const { creerParcours } = require('../src/parcours');

const E1 = '700000000000000001';
const urls = (composants) => (composants || []).flatMap((r) => r.components.map((b) => b.data.url));

async function payerElite(m, discordId) {
  const { lien } = m.commandes.creerInvitation('test');
  await m.poster(new URL(lien).pathname, { nom: 'Awa Sossou', email: 'awa@example.com' }, { cookie: cookieSession(discordId, 'awa_27') });
  m.saspay.payer(m.saspay.derniere().id);
  await m.etat(m.saspay.derniere().metadata.ref);
}

// Bob réel (messages capturés), branché sur l'application de test.
async function monterAvecBob() {
  const holder = {};
  const m = await monter({ avecCandidatures: true, oauth: fauxOAuth({ [E1]: [ROLES.elite] }),
    bob: { get parcours() { return holder.bob && holder.bob.parcours; } } });
  const dms = [];
  const parcours = creerParcours({ db: m.db, config: m.config });
  holder.bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, parcours,
    client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
  return { m, dms, parcours, bob: holder.bob };
}
const attendre = () => new Promise((r) => setTimeout(r, 30));

async function envoyer(m, cookie, emplacement, { note, retour } = {}) {
  const r = await fetch(`${m.base}/api/parcours/envoi`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ emplacement, note, retour }) });
  const d = await r.json();
  if (!r.ok) return { statut: r.status, ...d };
  const v = await fetch(`${m.base}/api/parcours/envoi/${d.id}/video`, { method: 'POST', headers: { 'Content-Type': 'video/mp4', cookie }, body: Buffer.alloc(4096, 3) });
  return { statut: v.status, id: d.id, ...(await v.json()) };
}

test('parcours Elite : étape 1 (exercices), étape 2 (coaching d\'entrée), étape 3 (3 vidéos, corrections), remarques et notifications', async () => {
  const { m, dms, parcours } = await monterAvecBob();
  try {
    const membre = cookieSession(E1, 'awa_27');
    const coach = cookieSession(ADMIN, 'overmaxx');
    await payerElite(m, E1);

    // Mon parcours : créé à la première visite, étape 1 avec son délai de 3 jours.
    const accueil = await (await m.get('/parcours', { cookie: membre })).text();
    assert.match(accueil, /Envoie tes exercices L1 et L2/);
    assert.match(accueil, /Il te reste 2 j 23 h|Il te reste 3 j 0 h/);
    assert.strictEqual(parcours.get(E1).etape, 1);
    assert.strictEqual((await m.get('/parcours/etape-2', { cookie: membre })).headers.get('location'), '/parcours', 'étape 2 pas encore ouverte');
    assert.match(await (await m.get('/coaching', { cookie: membre })).text(), /s(&#39;|')ouvrent à l(&#39;|')étape 3/);
    assert.strictEqual((await m.get('/parcours', { cookie: cookieSession('AUTRE', 'x') })).status, 403, 'réservé aux membres Elite');

    // Étape 1 : envois (note et retour de l'IA obligatoires), le coach est prévenu.
    assert.strictEqual((await envoyer(m, membre, 'L1', { note: 'abc', retour: 'Très bon travail sur le rythme.' })).statut, 400);
    assert.strictEqual((await envoyer(m, membre, 'V1')).statut, 400, 'vidéo de l\'étape 3 pas encore ouverte');
    const l1 = await envoyer(m, membre, 'L1', { note: 86, retour: 'Note : 86/100. Découpe propre, hook un peu lent.' });
    const l2 = await envoyer(m, membre, 'L2', { note: 90, retour: 'Note : 90/100. Très bon rythme et sous-titres lisibles.' });
    assert.strictEqual(l1.statut, 200);
    await attendre();
    assert.ok(dms.some(([id, t, c]) => id === ADMIN && /a envoyé l'exercice L1/.test(t) && urls(c)[0].includes('retour=%2Fadmin%2Fenvois%2F')));
    const fichierL1 = parcours.cheminVideo(parcours.soumission(l1.id));
    assert.ok(fs.existsSync(fichierL1));

    // Coach : À traiter, puis validation (pas de « refaire » à l'étape 1), niveau proposé L2.
    m.candidatures.demarrer('C1', 'nouveau'); m.candidatures.recevoirFormulaire('C1', [{ label: 'Quel est ton nom ?', valeur: 'Esi Amegah' }]);
    m.candidatures.demarrer('C2', 'retenu'); m.candidatures.recevoirFormulaire('C2', [{ label: 'Quel est ton nom ?', valeur: 'Kodjo Agbeko' }]);
    m.db.prepare("UPDATE candidatures SET statut = 'video' WHERE discord_id = 'C2'").run();
    const aTraiter = await (await m.get('/admin/a-traiter', { cookie: coach })).text();
    assert.match(aTraiter, /Exercice L1/);
    assert.match(aTraiter, /Exercice L2/);
    // Une seule file mélangée (étiquette sous chaque carte), filtres rangés par nombre ; les candidatures y sont aussi.
    assert.match(aTraiter, /data-filtre=""[^>]*>Tout/);
    assert.match(aTraiter, /data-cat="etape-1">Étape 1</);
    assert.match(aTraiter, /Kodjo Agbeko[\s\S]*Vidéo de présentation reçue/);
    assert.match(aTraiter, /Esi Amegah[\s\S]*Formulaire de candidature à examiner/);
    const filtres = [...aTraiter.matchAll(/data-filtre="([\w-]+)"[^>]*>[^<]*<b>(\d+)<\/b>/g)].map((x) => Number(x[2]));
    assert.deepStrictEqual(filtres, [...filtres].sort((x, y) => y - x), 'filtres rangés par nombre');
    assert.match(aTraiter, /href="\/admin\/candidatures\/\d+">Inspecter/);
    assert.match(await (await m.get(`/admin/envois/${l2.id}`, { cookie: coach })).text(), /Proposé : L2/);
    assert.strictEqual((await m.get(`/admin/envois/${l1.id}`, { cookie: membre })).status, 403);
    const refus = await m.poster(`/admin/envois/${l1.id}/decision`, { decision: 'corriger', texte: 'Refais.' }, { cookie: coach });
    assert.match(refus.headers.get('location'), /erreur=/);
    await m.poster(`/admin/envois/${l1.id}/decision`, { decision: 'valider', texte: 'Bien. Voix off un peu lente : vise 160 mots par minute.', niveau: 'L2' }, { cookie: coach });
    await m.poster(`/admin/envois/${l2.id}/decision`, { decision: 'valider', niveau: 'L2' }, { cookie: coach });
    await attendre();
    let p = parcours.get(E1);
    assert.strictEqual(p.etape, 2);
    assert.strictEqual(p.niveau, 'L2');
    assert.ok(p.etape1_le);
    assert.ok(!fs.existsSync(fichierL1), 'vidéos de l\'étape 1 supprimées après validation');
    assert.ok(dms.some(([id, t]) => id === E1 && /exercice L2 est validé/i.test(t) && /Étape 2 ouverte/.test(t)));

    // Étape 2 : un seul coaching d'entrée, à une date précise ; il apparaît dans le calendrier.
    const etape2 = await (await m.get('/parcours/etape-2', { cookie: membre })).text();
    assert.match(etape2, /Choisis ton coaching d'entrée/);
    const libre = m.coaching.creneauxLibres(7)[0];
    assert.strictEqual((await m.poster('/parcours/etape-2/reserver', { creneau: `${libre.date}|${libre.heure}` }, { cookie: membre })).status, 303);
    await attendre();
    assert.ok(dms.some(([id, t]) => id === ADMIN && /coaching d'entrée/.test(t)));
    assert.ok(m.coaching.occurrences(libre.date, libre.date).some((o) => o.discordId === E1 && o.type === 'entree'));
    assert.ok(!m.coaching.creneauxLibres(7).some((c) => c.date === libre.date && c.heure === libre.heure), 'créneau pris');
    assert.match(await (await m.get('/parcours/etape-2', { cookie: membre })).text(), /Prépare ton coaching/);

    // Le coach ouvre l'étape 3 depuis la fiche (compte, niche, pays).
    await m.poster(`/admin/membres/${E1}/compte`, { ouvrir: '3' }, { cookie: coach });
    p = parcours.get(E1);
    assert.strictEqual(p.etape, 3);
    assert.strictEqual(p.compte_tiktok, null, 'le compte TikTok se donne à l\'étape 4, pas avant');
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /Étape 3 ouverte/.test(t)));

    // Étape 3 : 3 vidéos ; « à corriger » (24 h), nouvelle version, puis validation des 3 → étape 4.
    const v = {};
    for (const e of ['V1', 'V2', 'V3']) v[e] = (await envoyer(m, membre, e)).id;
    await m.poster(`/admin/envois/${v.V2}/decision`, { decision: 'corriger' }, { cookie: coach }); // sans texte : refusé
    assert.strictEqual(parcours.soumission(v.V2).etat, 'attente');
    await m.poster(`/admin/envois/${v.V2}/decision`, { decision: 'corriger', texte: 'Coupe les 3 premières secondes.' }, { cookie: coach });
    await attendre();
    assert.strictEqual(parcours.soumission(v.V2).etat, 'corriger');
    assert.ok(dms.some(([id, t]) => id === E1 && /demande des modifications sur ta vidéo 2/.test(t)));
    const etape3 = await (await m.get('/parcours/etape-3', { cookie: membre })).text();
    assert.match(etape3, /À corriger/);
    assert.match(etape3, /Coupe les 3 premières secondes/);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Corrige ta vidéo 2/);
    assert.strictEqual((await envoyer(m, membre, 'V2')).statut, 200, 'nouvelle version');
    assert.strictEqual(parcours.soumission(v.V2).etat, 'attente');
    for (const e of ['V1', 'V2', 'V3']) await m.poster(`/admin/envois/${v[e]}/decision`, { decision: 'valider' }, { cookie: coach });
    p = parcours.get(E1);
    assert.strictEqual(p.etape, 4);
    assert.strictEqual(parcours.soumission(v.V1).fichier, null, 'vidéos de l\'étape 3 supprimées');
    // Arrivé à l'étape 4 sans niche : elle est demandée d'abord (obligatoire), puis le compte TikTok.
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Envoie ta niche/, 'étape 4 sans niche : la niche d\'abord');
    m.db.prepare("UPDATE parcours SET niche = 'Test', positionnement_le = '2026-01-01', positionnement_valide_le = '2026-01-01' WHERE discord_id = ?").run(E1);
    assert.match(await (await m.get('/parcours', { cookie: membre })).text(), /Ajoute le lien de ton compte TikTok/, 'étape 4 : ensuite le compte TikTok');

    // Remarque avec lien et image : le membre la voit, Bob le prévient ; l'image n'est visible que par lui et le coach.
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const img = await (await fetch(`${m.base}/admin/images`, { method: 'POST', headers: { 'Content-Type': 'image/png', cookie: coach }, body: png })).json();
    assert.match(img.nom, /^[a-f0-9]{24}\.png$/);
    assert.strictEqual((await fetch(`${m.base}/admin/images`, { method: 'POST', headers: { 'Content-Type': 'image/png', cookie: membre }, body: png })).status, 403);
    await m.poster(`/admin/membres/${E1}/remarque`, { titre: 'Ton hook', texte: 'Regarde ce **hook** : https://www.tiktok.com/@exemple', images: img.nom }, { cookie: coach });
    await attendre();
    assert.ok(dms.some(([id, t]) => id === E1 && /✉️ \*\*Ton hook\*\*\nRegarde ce \*\*hook\*\*/.test(t)), 'message depuis la fiche : titre en gras');
    const fiche = await (await m.get('/fiche', { cookie: membre })).text();
    assert.match(fiche, /href="https:\/\/www\.tiktok\.com\/@exemple"/);
    assert.match(fiche, /<b class="titre-msg">Ton hook<\/b>[\s\S]*Regarde ce <b>hook<\/b>/);
    assert.ok(fiche.includes(`/fichiers/images/${img.nom}`));
    assert.match(fiche, /class="remarque compacte"[\s\S]*class="apercu"/, 'remarques compactes : titre et aperçu, le reste à l\'ouverture');
    assert.strictEqual((await m.get(`/fichiers/images/${img.nom}`, { cookie: membre })).status, 200);
    assert.strictEqual((await m.get(`/fichiers/images/${img.nom}`, { cookie: cookieSession('AUTRE', 'x') })).status, 403);
    assert.match(await (await m.get(`/admin/membres/${E1}`, { cookie: coach })).text(), /Envoyer un message/);
  } finally { await m.fermer(); }
});

test('parcours : rappels de délai (moitié, 1 h avant, puis toutes les 12 h) et planning de coaching manquant', async () => {
  const { m, dms } = await monterAvecBob();
  try {
    let now = new Date('2026-12-01T10:00:00Z');
    const parcours = creerParcours({ db: m.db, config: m.config, maintenant: () => now });
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
    parcours.assurer(E1, { pseudo: 'awa_27' });
    const vers = () => dms.filter(([id]) => id === E1);
    now = new Date('2026-12-02T12:00:00Z'); await bob.relancerParcours();
    assert.strictEqual(vers().length, 0, '26 h sur 72 : rien');
    now = new Date('2026-12-02T23:00:00Z'); await bob.relancerParcours(); await bob.relancerParcours();
    assert.strictEqual(vers().length, 1, 'à la moitié du délai');
    assert.match(vers()[0][1], /Rappel : envoie tes exercices/);
    now = new Date('2026-12-04T09:30:00Z'); await bob.relancerParcours();
    assert.strictEqual(vers().length, 2, '1 h avant la fin');
    now = new Date('2026-12-04T11:00:00Z'); await bob.relancerParcours();
    now = new Date('2026-12-04T20:00:00Z'); await bob.relancerParcours();
    assert.strictEqual(vers().length, 3, 'en retard : un rappel par tranche de 12 h');
    now = new Date('2026-12-04T23:00:00Z'); await bob.relancerParcours();
    assert.strictEqual(vers().length, 4);
    assert.match(vers()[3][1], /En retard/);

    // Étape 3 sans planning : un rappel toutes les 12 h.
    parcours.changerEtape(E1, 3); // le 4 décembre à 23:00
    now = new Date('2026-12-05T10:00:00Z'); await bob.relancerParcours();
    assert.ok(!vers().some(([, t]) => /pas encore de planning/.test(t)), 'pas avant 12 h');
    now = new Date('2026-12-05T11:30:00Z'); await bob.relancerParcours(); await bob.relancerParcours();
    assert.strictEqual(vers().filter(([, t]) => /pas encore de planning/.test(t)).length, 1);
  } finally { await m.fermer(); }
});
