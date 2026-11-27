'use strict';

// Ressources (niches, méthodes 10K, tutoriels) : le coach publie, l'élève propose (validation du coach), likes, remarques ;
// étape 3 : niche, méthode et pays choisis, visibles par le coach seulement ; nom de l'élève cliquable.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');

test('ressources : publier, proposer, valider, aimer, remarque ; stratégie de l\'étape 3 privée', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    for (const id of ['A', 'B']) m.parcours.assurer(id, { pseudo: `p_${id}` });
    m.db.prepare("UPDATE parcours SET etape = 3 WHERE discord_id = 'A'").run();
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const A = { cookie: cookieSession('A', 'p_A') };
    const B = { cookie: cookieSession('B', 'p_B') };

    // Le coach publie une niche (tout de suite visible) et une méthode (meilleure pour L1).
    assert.match((await m.poster('/ressources/nouvelle', { type: 'niche', titre: 'Faits historiques', description: 'Anecdotes', categorie: 'L1',
      pays: ['France', 'Japon', 'Pays inventé'], rpm_min: '0,40', rpm_max: '1.2', exemples: '@histoire.vraie\nhttps://exemple.com/x', sources: 'tiktok.com/@source1' }, coach)).headers.get('location'), /fait=ajoute/);
    const niche = m.db.prepare("SELECT * FROM ressources WHERE type = 'niche'").get();
    assert.strictEqual(niche.etat, 'public');
    assert.deepStrictEqual(JSON.parse(niche.pays), ['France', 'Japon']);
    assert.deepStrictEqual([niche.rpm_min, niche.rpm_max], [0.4, 1.2]);
    assert.deepStrictEqual(JSON.parse(niche.exemples), ['https://www.tiktok.com/@histoire.vraie', 'https://exemple.com/x']);
    await m.poster('/ressources/nouvelle', { type: 'methode', titre: '', description: 'Carrousel de 7 images', categorie: 'carrousel', pour: 'L1' }, coach);
    const methode = m.db.prepare("SELECT * FROM ressources WHERE type = 'methode'").get();
    assert.strictEqual(methode.pour, 'L1');
    assert.strictEqual((await m.poster('/ressources/nouvelle', { type: 'niche', titre: 'X', description: 'y', categorie: 'L1', rpm_min: '2', rpm_max: '1' }, coach)).status, 400);

    // L'élève propose aussi des tutoriels et astuces, en étapes (texte + lien), avec ses images (5 au plus, la 1re en miniature).
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const envoyer = async (c) => (await (await fetch(`${m.base}/api/parcours/image`, { method: 'POST', headers: { 'Content-Type': 'image/png', cookie: c.cookie }, body: png })).json()).nom;
    const imgA = await envoyer(A); const imgB = await envoyer(B);
    const formTuto = await (await m.get('/ressources/nouvelle?type=tutoriel', A)).text();
    assert.match(formTuto, /Étapes[\s\S]*\+ Ajouter une étape[\s\S]*\+ Ajouter un lien/);
    assert.match(formTuto, /data-max="5"/);
    assert.match((await m.poster('/ressources/nouvelle', { type: 'tutoriel', titre: 'Garder les viewers', description: 'Deux tutos à suivre dans l\'ordre.', categorie: 'astuce',
      etape_texte: ['Regarde ce tuto et applique-le.', 'Puis celui-ci sur ta vidéo suivante.'], etape_lien: ['https://exemple.com/tuto1', 'pas un lien'], images: `${imgA},${imgB}` }, A)).headers.get('location') || '', /^$|erreur/);
    await m.poster('/ressources/nouvelle', { type: 'tutoriel', titre: 'Garder les viewers', description: 'Deux tutos à suivre dans l\'ordre.', categorie: 'astuce',
      etape_texte: ['Regarde ce tuto et applique-le.', 'Puis celui-ci.'], etape_lien: ['https://exemple.com/tuto1', ''], exemples: ['@exemple.un', '@exemple.deux'], images: `${imgA},${imgB}` }, A);
    const tuto = m.db.prepare("SELECT * FROM ressources WHERE type = 'tutoriel'").get();
    assert.strictEqual(tuto.etat, 'attente');
    assert.deepStrictEqual(JSON.parse(tuto.etapes), [{ texte: 'Regarde ce tuto et applique-le.', lien: 'https://exemple.com/tuto1' }, { texte: 'Puis celui-ci.', lien: null }]);
    assert.deepStrictEqual(JSON.parse(tuto.images), [imgA], 'l\'image d\'un autre élève est écartée');
    assert.deepStrictEqual(JSON.parse(tuto.exemples), ['https://www.tiktok.com/@exemple.un', 'https://www.tiktok.com/@exemple.deux'], 'liens ajoutés un par un');
    assert.strictEqual((await m.get(`/fichiers/images/${imgA}`, B)).status, 403, 'pas encore validée : image privée');
    await m.poster(`/admin/ressources/${tuto.id}/decision`, { decision: 'valider' }, coach);
    assert.strictEqual((await m.get(`/fichiers/images/${imgA}`, B)).status, 200, 'validée : image visible par tous');
    const listeTutos = await (await m.get('/ressources?type=tutoriel', B)).text();
    assert.match(listeTutos, new RegExp(`class="rs-mini" style="background-image:url\\('/fichiers/images/${imgA}'\\)"[\\s\\S]*<b class="rs-titre">Garder les viewers</b>[\\s\\S]*2 étapes`));
    assert.match(await (await m.get(`/ressources/${tuto.id}`, B)).text(), /class="rs-etapes"[\s\S]*Regarde ce tuto[\s\S]*exemple\.com\/tuto1/);

    // Une niche proposée attend le coach, invisible pour les autres, modifiable par lui.
    await m.poster('/ressources/nouvelle', { type: 'niche', titre: 'Recettes à 2 €', description: 'Cuisine pas chère', categorie: 'L2', pour: 'L2' }, A);
    const prop = m.db.prepare("SELECT * FROM ressources WHERE auteur = 'A' AND type = 'niche'").get();
    assert.strictEqual(prop.etat, 'attente');
    assert.ok(appels.some(([n]) => n === 'ressourceProposee'));
    assert.strictEqual((await m.get(`/ressources/${prop.id}`, B)).status, 404);
    assert.doesNotMatch(await (await m.get('/ressources?type=niche', B)).text(), /Recettes/);
    assert.match(await (await m.get('/ressources?type=niche', A)).text(), /Recettes à 2 €[\s\S]*En attente du coach/);
    assert.match((await m.poster(`/ressources/${prop.id}/modifier`, { titre: 'Recettes à 2 euros', description: 'Cuisine pas chère', categorie: 'L2' }, A)).headers.get('location'), /fait=modifie/);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /data-filtre="ressources"[\s\S]*Propose la niche <b>Recettes à 2 euros<\/b>/);

    // Étape 3 : niche (même sa proposition), méthode, pays parmi les 8.
    assert.match(await (await m.get('/parcours', A)).text(), /Choisis ta niche, ta méthode et ton pays/);
    const etape3 = await (await m.get('/parcours/etape-3', A)).text();
    assert.match(etape3, /Mon positionnement[\s\S]*Recettes à 2 euros \(en attente du coach\)[\s\S]*Ajouter ma niche[\s\S]*Corée du Sud/);
    assert.match(etape3, /<option value="\d+">Faits historiques<\/option>/);
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: prop.id, methode: methode.id, pays: 'Belgique' }, A)).headers.get('location'), /erreur=/);
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: prop.id, methode: methode.id, pays: 'Japon' }, A)).headers.get('location'), /fait=strategie/);
    assert.strictEqual(m.parcours.strategie('A').complete, true);
    assert.ok(appels.some(([n, , t]) => n === 'activiteEleve' && /positionnement/.test(t)), 'le coach est prévenu');
    // Le coach le voit « à valider » (jaune) dans À traiter et sur la fiche, le formulaire derrière « Modifier » ; il valide → verrouillé.
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /data-filtre="positionnement"[\s\S]*Positionnement à valider/);
    const ficheA = await (await m.get('/admin/membres/A', coach)).text();
    assert.match(ficheA, /id="positionnement"[\s\S]*Envoyé · à valider[\s\S]*Valider le positionnement[\s\S]*<summary[^>]*>Modifier<\/summary>/);
    await m.poster('/admin/membres/A/positionnement/valider', {}, coach);
    assert.strictEqual(m.parcours.strategie('A').valide, true);
    assert.match(await (await m.get('/parcours/etape-3', A)).text(), /Mon positionnement[\s\S]*Acté[\s\S]*ne se change plus/);
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: niche.id, methode: methode.id, pays: 'France' }, A)).headers.get('location'), /erreur=/, 'verrouillé');
    assert.strictEqual(m.parcours.get('A').pays_cible, 'Japon');
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: prop.id, methode: '999', pays: 'Japon' }, B)).headers.get('location'), /parcours|erreur/);

    // Le coach valide : publique, l'élève est prévenu ; il ne peut plus la modifier.
    await m.poster(`/admin/ressources/${prop.id}/decision`, { decision: 'valider' }, coach);
    assert.strictEqual(m.db.prepare('SELECT etat FROM ressources WHERE id = ?').get(prop.id).etat, 'public');
    assert.ok(appels.some(([n, r]) => n === 'ressourceDecidee' && r.id === prop.id));
    assert.match(await (await m.get(`/ressources/${prop.id}`, B)).text(), /Recettes à 2 euros/);
    assert.strictEqual((await m.get(`/ressources/${prop.id}/modifier`, A)).headers.get('location'), `/ressources/${prop.id}`);

    // Likes : un par élève, retirable.
    await m.poster(`/ressources/${niche.id}/aimer`, {}, A);
    await m.poster(`/ressources/${niche.id}/aimer`, {}, B);
    await m.poster(`/ressources/${niche.id}/aimer`, {}, B);
    assert.strictEqual(m.db.prepare('SELECT COUNT(*) n FROM ressources_likes').get().n, 1);
    // Remarque sur une ressource : un message au coach.
    await m.poster(`/ressources/${niche.id}/remarque`, { texte: 'Le compte exemple est privé.' }, B);
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Ressource : Faits historiques[\s\S]*Le compte exemple est privé/);

    // Stratégie : le coach la voit sur le profil de l'élève ; jamais dans le profil public ni le classement.
    assert.match(await (await m.get('/admin/membres/A/profil', coach)).text(), /Sa stratégie[\s\S]*Recettes à 2 euros[\s\S]*Japon/);
    assert.doesNotMatch(await (await m.get('/classement/A', B)).text(), /Recettes|Japon/);
    assert.doesNotMatch(await (await m.get('/classement', B)).text(), /Recettes/);
  } finally { await m.fermer(); }
});

test('forum Discord : chaque ressource publique y est postée avec ses tags (double base)', async () => {
  const FR = require('../src/forum-ressources');
  const niche = { id: 7, type: 'niche', titre: 'Tricotage', description: 'Tutos de tricot.', categorie: 'L1', pays: ['Allemagne', 'France', 'Angleterre', 'Brésil'],
    rpm_min: 0.4, rpm_max: 1.2, exemples: ['https://www.tiktok.com/@tricot.vrai'], contre_exemples: [], sources: ['https://www.tiktok.com/@source'], images: [], etapes: [] };
  assert.strictEqual(FR.titreDe(niche), '🚀 Tricotage (Repost amélioré)');
  assert.deepStrictEqual(FR.tagsDe(niche), ['repost']);
  assert.deepStrictEqual(FR.tagsDe({ ...niche, categorie: 'L2' }), ['Cmtry']);
  assert.deepStrictEqual(FR.tagsDe({ type: 'methode' }), ['10k Abos']);
  assert.deepStrictEqual(FR.tagsDe({ type: 'tutoriel' }), ['guide']);
  const c = FR.contenuDe(niche, { auteur: 'awa_27', baseUrl: 'https://overmaxx.test' });
  assert.match(c, /\*\*Thématique : Tricotage\*\*[\s\S]*Pays recommandés : 🇩🇪 🇫🇷 🇬🇧 🇧🇷[\s\S]*RPM : \$0\.40 – \$1\.20[\s\S]*Comptes exemples :\n@tricot\.vrai[\s\S]*Comptes sources :\n@source[\s\S]*Proposée par awa_27 · sur la plateforme : https:\/\/overmaxx\.test\/ressources\/7/);
  assert.strictEqual(FR.titreDe({ type: 'methode', titre: 'Versus #1', categorie: 'video' }), '😈 (Méthode) 10k - Versus #1');
  assert.match(FR.contenuDe({ id: 2, type: 'tutoriel', titre: 'Viewers', categorie: 'astuce', etapes: [{ texte: 'Regarde ce tuto', lien: 'https://x.y/1' }], exemples: [] }), /\*\*Étape 1 :\*\* Regarde ce tuto\nhttps:\/\/x\.y\/1/);

  // La plateforme poste (coach : tout de suite ; élève : à la validation), puis garde l'identifiant du post.
  const posts = [];
  const m = await monter({ bob: { parcours: { publierRessource: async (r, auteur) => { posts.push([r.id, r.etat, auteur]); return `fil-${r.id}`; }, ressourceProposee: async () => {}, ressourceDecidee: async () => {} } } });
  try {
    m.parcours.assurer('A', { pseudo: 'p_A' });
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    await m.poster('/ressources/nouvelle', { type: 'niche', titre: 'Tricotage', description: 'x', categorie: 'L1' }, coach);
    await m.poster('/ressources/nouvelle', { type: 'methode', description: 'Carrousel', categorie: 'carrousel' }, { cookie: cookieSession('A', 'p_A') });
    await new Promise((x) => setTimeout(x, 20));
    assert.deepStrictEqual(posts, [[1, 'public', null]], 'une proposition n\'est pas postée');
    await m.poster('/admin/ressources/2/decision', { decision: 'valider' }, coach);
    await new Promise((x) => setTimeout(x, 20));
    assert.deepStrictEqual(posts[1], [2, 'public', 'p_A']);
    assert.deepStrictEqual(m.db.prepare('SELECT discord_fil FROM ressources ORDER BY id').all().map((x) => x.discord_fil), ['fil-1', 'fil-2']);
    // Modifiée : le même post est mis à jour.
    await m.poster('/ressources/1/modifier', { titre: 'Tricot', description: 'y', categorie: 'L1' }, coach);
    await new Promise((x) => setTimeout(x, 20));
    assert.deepStrictEqual(posts[2], [1, 'public', null]);
  } finally { await m.fermer(); }
});

test('Bob crée le forum « ressources » (tags) une seule fois, publie puis met à jour le post', async () => {
  const { creerBob } = require('../src/bob');
  const m = await monter();
  try {
    const crees = []; const fils = new Map(); const dms = [];
    const forum = {
      id: 'F1', availableTags: [],
      threads: {
        create: async (o) => { const f = { id: `T${fils.size + 1}`, o, edit: async (x) => { f.edite = x; }, fetchStarterMessage: async () => ({ edit: async (x) => { f.message = x; } }) }; fils.set(f.id, f); return f; },
        fetch: async (id) => fils.get(id) || null,
      },
    };
    const serveur = {
      id: 'G', roles: { everyone: { id: 'G' } }, members: { fetch: async (id) => ({ id, roles: { cache: new Set() } }) },
      channels: {
        create: async (o) => { crees.push(o); forum.availableTags = o.availableTags.map((t, i) => ({ ...t, id: `tag${i}` })); return forum; },
        fetch: async (id) => (id === 'F1' && crees.length ? forum : null),
      },
    };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, parcours: m.parcours, suivi: m.suivi,
      sinistres: m.sinistres, serveur, client: { isReady: () => true, user: { id: 'BOB' }, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content || c]) }) } } });
    const r = { id: 3, type: 'niche', titre: 'Tricotage', description: 'x', categorie: 'L2', pays: ['France'], rpm_min: null, rpm_max: null, exemples: [], contre_exemples: [], sources: [], images: [], etapes: [] };
    const id = await bob.parcours.publierRessource(r, null);
    assert.strictEqual(id, 'T1');
    assert.strictEqual(crees.length, 1);
    assert.strictEqual(crees[0].name, 'ressources');
    assert.deepStrictEqual(crees[0].availableTags.map((t) => t.name), ['10k Abos', 'repost', 'Cmtry', 'guide']);
    assert.ok(crees[0].permissionOverwrites.some((p) => p.id === 'G' && p.deny.length), 'caché à @everyone');
    assert.deepStrictEqual(fils.get('T1').o.appliedTags, ['tag2'], 'L2 → Cmtry');
    assert.match(fils.get('T1').o.message.content, /Thématique : Tricotage/);
    // Deuxième publication du même : mise à jour, pas de nouveau forum ni de nouveau post.
    assert.strictEqual(await bob.parcours.publierRessource({ ...r, titre: 'Tricot', discord_fil: 'T1' }, null), 'T1');
    assert.strictEqual(crees.length, 1);
    assert.strictEqual(fils.size, 1);
    assert.strictEqual(fils.get('T1').edite.name, '🚀 Tricot (Commentaire)');
    assert.match(fils.get('T1').message.content, /Thématique : Tricot\*\*/);
  } finally { await m.fermer(); }
});

test('import d\'un ancien forum : posts lus (titre, tags, thématique, drapeaux, comptes), importés une seule fois, postés dans le nouveau forum', async () => {
  const { analyserPost } = require('../src/import-forum');
  const tricot = analyserPost({ nomFil: '🚀 Niche (Repost Amelioré)', tags: ['repost'],
    contenu: 'Thématique : tricotage\n\nNiveau minimum requis : aucun\npays Recommandés : 🇩🇪🇫🇷🇬🇧🇧🇷\nTutoriel Repost amélioré: https://whop.com/x\n\nComptes sources :\nhttps://www.tiktok.com/@halilah.arte?lang=fr' });
  assert.strictEqual(tricot.type, 'niche');
  assert.strictEqual(tricot.champs.categorie, 'L1');
  assert.strictEqual(tricot.champs.titre, 'Tricotage');
  assert.deepStrictEqual(tricot.champs.pays, ['Allemagne', 'France', 'Angleterre', 'Brésil']);
  assert.strictEqual(tricot.champs.sources, 'https://www.tiktok.com/@halilah.arte');
  assert.strictEqual(analyserPost({ nomFil: '😈 (Méthode) 10k - Versus #1', tags: ['10k Abos'], contenu: 'Prompt Versus 10k' }).type, 'methode');
  assert.strictEqual(analyserPost({ nomFil: '😈 (Méthode) 10k - Versus #1', tags: ['10k Abos'], contenu: 'x' }).champs.titre, 'Versus #1');
  assert.strictEqual(analyserPost({ nomFil: '😈 (Niche) 10k - Politique', tags: ['Cmtry'], contenu: 'Concept' }).champs.categorie, 'L2');
  assert.strictEqual(analyserPost({ nomFil: 'Tout les documents de la formation', tags: ['guide'], contenu: 'ici' }).type, 'tutoriel');

  // Bob : lit le forum (actifs et archivés), crée les ressources, les poste dans le nouveau forum, pas de doublon.
  const { creerBob } = require('../src/bob');
  const { ChannelType } = require('discord.js');
  const m = await monter();
  try {
    const dms = [];
    const fil = (id, name, tag, content) => ({ id, name, appliedTags: [tag], fetchStarterMessage: async () => ({ content, attachments: new Map() }) });
    const ancien = { id: '777888999000111222', name: 'niches', type: ChannelType.GuildForum, availableTags: [{ id: 't1', name: 'repost' }, { id: 't2', name: '10k Abos' }],
      threads: { fetchActive: async () => ({ threads: new Map([['P1', fil('P1', '🚀 Niche (Repost amélioré)', 't1', 'Thématique : Lego ASMR\n🇫🇷')]]) }),
        fetchArchived: async () => ({ threads: new Map([['P2', fil('P2', '😈 (Méthode) 10k - Versus #1', 't2', 'Prompt Versus')]]), hasMore: false }) } };
    const nouveaux = new Map();
    const forum = { id: 'F1', availableTags: [], threads: { create: async (o) => { const f = { id: `T${nouveaux.size + 1}`, o }; nouveaux.set(f.id, f); return f; }, fetch: async (id) => nouveaux.get(id) || null } };
    const serveur = { id: 'G', roles: { everyone: { id: 'G' } }, members: { fetch: async (id) => ({ id, roles: { cache: new Set() } }) },
      channels: { create: async (o) => { forum.availableTags = o.availableTags.map((t, i) => ({ ...t, id: `tag${i}` })); return forum; }, fetch: async () => null } };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, candidatures: m.candidatures, parcours: m.parcours, suivi: m.suivi,
      sinistres: m.sinistres, serveur, client: { isReady: () => true, user: { id: 'BOB' }, channels: { fetch: async (id) => (id === '777888999000111222' ? ancien : null) },
        users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content || c]) }) } } });
    assert.match((await bob.parcours.importerForum('pas un lien')).erreur, /lien du forum/);
    assert.match((await bob.parcours.importerForum('https://discord.com/channels/1/999')).erreur, /ne voit pas ce forum/);
    const r = await bob.parcours.importerForum('https://discord.com/channels/123/777888999000111222');
    assert.strictEqual(r.importes, 2);
    assert.strictEqual((await bob.parcours.importerForum('777888999000111222')).misAJour, 2, 'relancé : mis à jour, rien en double');
    const lignes = m.db.prepare('SELECT type, titre, categorie, etat, source_discord, discord_fil FROM ressources ORDER BY id').all();
    assert.deepStrictEqual(lignes.map((x) => [x.type, x.titre, x.etat, x.source_discord]), [['niche', 'Lego ASMR', 'public', 'P1'], ['methode', 'Versus #1', 'public', 'P2']]);
    assert.ok(lignes.every((x) => x.discord_fil), 'postées dans le nouveau forum');
    assert.strictEqual(nouveaux.size, 2, 'importées une seule fois malgré 2 lancements');
    assert.ok(dms.some(([, t]) => /Import du forum « niches » terminé/.test(t)));
  } finally { await m.fermer(); }
});
