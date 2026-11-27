'use strict';

// « Demander de l'aide » : la demande guidée arrive chez le coach (À traiter, Bob) avec le résumé des 3 points.

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession, ADMIN } = require('./aide');
const { composer, etatAxes } = require('../src/aide');

const E1 = '700000000000000041';

test('composer : le résumé pour le coach, et les champs obligatoires', () => {
  const axes = etatAxes({ tutos_vus: '["hook"]' }, [{ axe: 'hook', etat: 'valide', envoye_le: '2026-01-01' }]);
  assert.deepStrictEqual(axes.map((a) => [a.cle, a.vu, a.video && a.video.libelle]), [['hook', true, 'prête à publier'], ['engagement', false, null], ['watchtime', false, null]]);
  assert.match(composer({ categorie: 'x', texte: 'Bonjour coach' }).erreur, /Choisis/);
  assert.match(composer({ categorie: 'vues', texte: 'court' }).erreur, /Explique/);
  const c = composer({ categorie: 'vues', axe: 'hook', video: 'https://www.tiktok.com/@a/video/1', texte: 'Je plafonne à 300 vues.' }, axes);
  assert.strictEqual(c.sujet, 'Demande d\'aide · Vues');
  assert.match(c.texte, /Problème : Mes vidéos ne font pas assez de vues\nCe qui bloque, selon lui : Le hook\nVidéo : https:\/\/www\.tiktok\.com\/@a\/video\/1\nLeçons regardées : Hook ✓ · Engagement ✗ · Watchtime ✗\nVidéos relues : Hook \(prête à publier\) · Engagement — · Watchtime —\n\nJe plafonne à 300 vues\./);
  // Un problème technique : pas de résumé des 3 points.
  assert.doesNotMatch(composer({ categorie: 'technique', texte: 'Bob ne m\'envoie plus rien.' }, axes).texte, /Leçons/);
});

test('/aide : assistant, envoi au coach, À traiter, réponse', async () => {
  const appels = [];
  const bob = { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) };
  const m = await monter({ bob });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const membre = { cookie: cookieSession(E1, 'awa_27') };
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const page = await (await m.get('/aide', membre)).text();
    assert.match(page, /Qu.{1,6}est-ce qui se passe[\s\S]*data-valeur="categorie=vues"[\s\S]*Les 3 points|Qu.{1,6}est-ce qui se passe[\s\S]*data-valeur="categorie=vues"/);
    assert.match(page, /D.{1,6}abord, les 3 points[\s\S]*Leçon pas regardée/);
    assert.match(page, /href="\/aide"[\s\S]*Demander de l.{1,6}aide/, 'dans le menu');
    // Erreur : pas de catégorie.
    const r0 = await m.poster('/aide', { texte: 'Mes vidéos plafonnent.' }, membre);
    assert.match(r0.headers.get('location'), /erreur=/);
    const r = await m.poster('/aide', { categorie: 'vues', axe: 'watchtime', video: '', texte: 'Mes vidéos plafonnent à 200 vues.' }, membre);
    assert.strictEqual(r.headers.get('location'), '/aide?fait=1');
    assert.match(await (await m.get('/aide?fait=1', membre)).text(), /Ton coach a reçu ta demande/);
    const msg = m.db.prepare('SELECT * FROM messages_coach WHERE discord_id = ?').get(E1);
    assert.strictEqual(msg.sujet, 'Demande d\'aide · Vues');
    assert.match(msg.texte, /Ce qui bloque, selon lui : Le watchtime/);
    assert.ok(appels.some(([n]) => n === 'messageAuCoach'), 'Bob prévient le coach');
    // Le coach : dans À traiter, puis la page du message.
    assert.match(await (await m.get('/admin/a-traiter', coach)).text(), /Demande d.{1,6}aide · Vues/);
    assert.match(await (await m.get(`/admin/messages-recus/${msg.id}`, coach)).text(), /Leçons regardées : Hook ✗/);
    // L'élève voit sa demande dans « Mes dernières demandes ».
    assert.match(await (await m.get('/aide', membre)).text(), /Mes dernières demandes[\s\S]*Vues/);
    // Le lien depuis la section Progresser de l'étape 4.
    assert.match(await (await m.get('/parcours/etape-4', membre)).text(), /Bloqué \? Demander de l.{1,6}aide/);
  } finally { await m.fermer(); }
});
