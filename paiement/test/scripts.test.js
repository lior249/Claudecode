'use strict';

// Vérifie que le JavaScript intégré à chaque page est valide (une erreur de syntaxe = page blanche).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { monter, fauxOAuth, cookieSession, ADMIN, ROLES } = require('./aide');

function verifierScripts(html, page) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  for (const code of scripts) {
    assert.doesNotThrow(() => new vm.Script(code), `JavaScript invalide sur ${page}`);
  }
  return scripts.length;
}

test('le JavaScript de toutes les pages est valide', async () => {
  const oauth = fauxOAuth({ E1: [ROLES.elite] });
  const m = await monter({ oauth, avecCandidatures: true });
  try {
    await m.poster('/community/paiement', { nom: 'Awa', email: 'awa@example.com' });
    const ref = m.saspay.derniere().metadata.ref;
    m.candidatures.demarrer('C1', 'c1'); m.candidatures.recevoirFormulaire('C1', [{ label: 'Q', valeur: 'R' }]); m.candidatures.decider(1, 'retenir');
    const pages = [
      ['/community', null], ['/coaching/elite', null], [`/confirmation/${ref}`, null],
      ['/coaching', cookieSession('E1', 'e1')], ['/admin', cookieSession(ADMIN, 'a')], ['/admin/candidatures', cookieSession(ADMIN, 'a')],
      ['/coaching/elite/candidature', cookieSession('C1', 'c1')],
      ['/coaching?mode=semaine', cookieSession('E1', 'e1')], ['/admin/disponibilites', cookieSession(ADMIN, 'a')], ['/admin/imprevu', cookieSession(ADMIN, 'a')],
    ];
    let total = 0;
    for (const [chemin, cookie] of pages) {
      const html = await (await m.get(chemin, cookie ? { cookie } : {})).text();
      total += verifierScripts(html, chemin);
    }
    assert.ok(total >= 7, `${total} scripts vérifiés`);
  } finally { await m.fermer(); }
});

test('le JavaScript des pages du parcours Elite est valide (envois, heures locales, images du coach)', async () => {
  const m = await monter({ avecCandidatures: true });
  try {
    const { creerParcours } = require('../src/parcours');
    const parcours = creerParcours({ db: m.db, config: m.config });
    parcours.assurer('P1', { pseudo: 'p1' });
    const membre = cookieSession('P1', 'p1');
    const coach = cookieSession(ADMIN, 'a');
    const r = parcours.preparerEnvoi('P1', 'L1', { note: 80, retour: 'Retour complet de l\'IA.' });
    const pages = [['/parcours', membre], ['/parcours/etape-1', membre], ['/fiche', membre], ['/admin/a-traiter', coach], [`/admin/envois/${r.soumission.id}`, coach], ['/admin/membres/P1', coach]];
    parcours.changerEtape('P1', 3);
    pages.push(['/parcours/etape-2', membre], ['/parcours/etape-3', membre]);
    // Étape 4 : heures, déclaration, compte rendu (membre) et sa validation (coach).
    parcours.assurer('P2', { pseudo: 'p2' });
    parcours.changerEtape('P2', 4);
    const membre2 = cookieSession('P2', 'p2');
    pages.push(['/parcours/etape-4', membre2]);
    m.suivi.choisirHeures('P2', { creation: '09:00', publication: '10:00', compteRendu: '10:00', fuseau: 'Africa/Lome' });
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    m.db.prepare("INSERT INTO publications (discord_id, jour, lien, cree_le) VALUES ('P2', ?, 'https://www.tiktok.com/@p2/video/1', ?)").run(hier, new Date().toISOString());
    m.db.prepare("INSERT INTO images_membres (nom, discord_id, cree_le) VALUES ('aaaaaaaaaaaaaaaaaaaaaaaa.png', 'P2', ?)").run(new Date().toISOString());
    pages.push(['/parcours/etape-4', membre2], [`/parcours/compte-rendu/${hier}`, membre2]);
    const cr = m.suivi.enregistrerCompteRendu('P2', hier, { total_mois: 12.5, abonnes_total: 120, vues_total: 5400, abonnes_jour: 12, vues_jour: 900, pays_vues: ['France'], pays_abonnes: ['France'],
      capture_revenus: 'aaaaaaaaaaaaaaaaaaaaaaaa.png', videos: { 1: { vues: 900, abonnes: 12, heure: '10:00', visionnage_s: 7, retention_10s: 41.5, revenus: 3.2 } } });
    assert.ok(cr.compteRendu, JSON.stringify(cr));
    pages.push([`/admin/comptes-rendus/${cr.compteRendu.id}`, coach], ['/admin/membres/P2', coach], ['/profil', membre2], ['/admin/membres/P2/profil', coach]);
    // Sinistré : sa fiche de sinistre.
    parcours.assurer('P3', { pseudo: 'p3' });
    m.sinistres.ouvrir('P3');
    pages.push(['/sinistre', cookieSession('P3', 'p3')]);
    let total = 0;
    for (const [chemin, cookie] of pages) {
      const res = await m.get(chemin, { cookie });
      assert.strictEqual(res.status, 200, chemin);
      total += verifierScripts(await res.text(), chemin);
    }
    assert.ok(total >= 7, `${total} scripts vérifiés`);
  } finally { await m.fermer(); }
});
