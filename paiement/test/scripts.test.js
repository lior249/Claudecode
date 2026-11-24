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
