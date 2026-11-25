'use strict';

// Classement (top 100) : ordre par récompenses validées, podium (médaille pour le premier seulement), vues abrégées,
// sa place s'il est hors du top 100, profils visibles seulement dans le top 100.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { vuesCourtes, roleLePlusHaut } = require('../src/pages-classement');

// Un compte rendu validé : total du mois (récompenses) et vues du compte.
function resultat(m, id, jour, total, vues) {
  m.db.prepare("INSERT INTO comptes_rendus (discord_id, jour, etat, total_mois, vues_total, cree_le) VALUES (?, ?, 'valide', ?, ?, ?)").run(id, jour, total, vues, new Date().toISOString());
}

test('vues abrégées et rôle le plus élevé', () => {
  assert.deepStrictEqual([0, 999, 1000, 1250, 45872, 1200000, 3400000000].map(vuesCourtes), ['0', '999', '1K', '1.2K', '45.8K', '1.2M', '3.4Md']);
  assert.strictEqual(roleLePlusHaut([{ role: 'goat', confirme_le: 'x' }, { role: '1500', confirme_le: 'x' }]), '1500');
  assert.strictEqual(roleLePlusHaut([{ role: '5000', confirme_le: null }, { role: 'goat', confirme_le: 'x' }]), 'goat', 'pas encore confirmé : ne compte pas');
});

test('classement : podium or / argent / bronze, top 100, sa place, profils publics du top 100 seulement', async () => {
  const m = await monter();
  try {
    const jour = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const eleves = [['A1', 'awa_27', 'Awa', 4210, 1250000], ['A2', 'kodjo.tt', 'Kodjo', 9800, 3400000], ['A3', 'esi_creat', 'Esi', 870, 45872], ['A4', 'yao_k', 'Yao', 2100, 999]];
    for (const [id, pseudo, prenom, total, vues] of eleves) {
      m.parcours.assurer(id, { pseudo, nom: `${prenom} Nom-de-famille` });
      m.db.prepare('INSERT INTO profils_membres (discord_id, prenom, maj_le) VALUES (?, ?, ?)').run(id, prenom, new Date().toISOString());
      resultat(m, id, jour, total, vues);
    }
    m.db.prepare("INSERT INTO recompenses (discord_id, role, atteint_le, confirme_le) VALUES ('A2', '5000', ?, ?)").run(jour, jour);
    // 100 autres élèves sans résultats : ils passent après.
    for (let i = 0; i < 100; i++) m.parcours.assurer(`Z${i}`, { pseudo: `eleve${i}` });

    const page = await (await m.get('/classement', { cookie: cookieSession('A3', 'esi_creat') })).text();
    assert.match(page, /\$16,980/, 'revenus générés sur Overmaxx');
    const ordre = ['Kodjo', 'Awa', 'Yao', 'Esi'].map((n) => page.indexOf(`>${n}</a>`));
    assert.ok(ordre.every((x, i) => x > 0 && (i === 0 || x > ordre[i - 1])), `ordre ${ordre}`);
    assert.strictEqual((page.match(/class="medaille"/g) || []).length, 1, 'médaille pour le premier seulement');
    assert.match(page, /class="metal or"[\s\S]*Kodjo[\s\S]*class="metal argent"[\s\S]*Awa[\s\S]*class="metal bronze"[\s\S]*Yao/);
    assert.match(page, /3\.4M/);
    assert.match(page, /👑 €5k Club 👑/);
    assert.match(page, /role-d" style="--rc:#4f46ff">Elite/, "pastille Elite aux couleurs du rôle Discord");
    assert.doesNotMatch(page, /Nom-de-famille/, 'jamais son nom complet');
    assert.strictEqual((page.match(/<tr[ >]/g) || []).length - 1, 97, 'top 100 : 3 sur le podium, 97 dans le tableau');

    // Hors du top 100 : il voit sa place ; son profil n'est pas visible des autres.
    const dernier = await (await m.get('/classement', { cookie: cookieSession('Z99', 'eleve99') })).text();
    assert.match(dernier, /Tu es <b>104<sup>e<\/sup><\/b> sur 104/);
    assert.strictEqual((await m.get('/classement/A2', { cookie: cookieSession('Z99', 'eleve99') })).status, 200);
    assert.strictEqual((await m.get('/classement/Z99', { cookie: cookieSession('A1', 'awa_27') })).status, 404);
    assert.strictEqual((await m.get('/classement/Z99', { cookie: cookieSession('Z99', 'eleve99') })).status, 200, 'le sien');
    assert.strictEqual((await m.get('/classement/Z99', { cookie: cookieSession(ADMIN, 'coach') })).status, 200, 'le coach voit tout');
  } finally { await m.fermer(); }
});
