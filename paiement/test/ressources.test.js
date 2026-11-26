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
    assert.match(etape3, /Ma stratégie[\s\S]*Recettes à 2 euros \(en attente du coach\)[\s\S]*Ajouter ma niche[\s\S]*Corée du Sud/);
    assert.match(etape3, /<option value="\d+">Faits historiques<\/option>/);
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: prop.id, methode: methode.id, pays: 'Belgique' }, A)).headers.get('location'), /erreur=/);
    assert.match((await m.poster('/parcours/etape-3/strategie', { niche: prop.id, methode: methode.id, pays: 'Japon' }, A)).headers.get('location'), /fait=strategie/);
    assert.strictEqual(m.parcours.strategie('A').complete, true);
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
