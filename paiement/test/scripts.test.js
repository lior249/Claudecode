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
    ];
    let total = 0;
    for (const [chemin, cookie] of pages) {
      const html = await (await m.get(chemin, cookie ? { cookie } : {})).text();
      total += verifierScripts(html, chemin);
    }
    assert.ok(total >= 5, `${total} scripts vérifiés`);
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
    let total = 0;
    for (const [chemin, cookie] of pages) {
      const res = await m.get(chemin, { cookie });
      assert.strictEqual(res.status, 200, chemin);
      total += verifierScripts(await res.text(), chemin);
    }
    assert.ok(total >= 8, `${total} scripts vérifiés`);
  } finally { await m.fermer(); }
});
