'use strict';

// Résultats publics : salon des résultats (vidéos, monétisation) et forum Testimonials (updates de fin de mois).

const test = require('node:test');
const assert = require('node:assert');
const { monter, cookieSession } = require('./aide');
const { creerBob } = require('../src/bob');
const { moisDeLUpdate, creerUpdatesMois } = require('../src/updates-mois');

const E1 = '700000000000000051';

test('fenêtre des updates du mois : du 28 au 5 du mois suivant', () => {
  assert.strictEqual(moisDeLUpdate('2026-11-27'), null);
  assert.strictEqual(moisDeLUpdate('2026-11-28'), '2026-11');
  assert.strictEqual(moisDeLUpdate('2026-11-30'), '2026-11');
  assert.strictEqual(moisDeLUpdate('2026-12-01'), '2026-11');
  assert.strictEqual(moisDeLUpdate('2027-01-05'), '2026-12');
  assert.strictEqual(moisDeLUpdate('2027-01-06'), null);
});

test('updates du mois : sans revenus, le modèle « revenus d\'une vidéo » est refusé ; avec, les 3 questions sont obligatoires', async () => {
  const m = await monter();
  try {
    const u = creerUpdatesMois({ db: m.db });
    assert.deepStrictEqual(u.aFaire(E1, '2026-11-29').map((x) => x.type), ['revenus', 'resultat']);
    assert.deepStrictEqual(u.aFaire(E1, '2026-11-20'), []);
    u.enregistrerRevenus(E1, '2026-11', { aGagne: false });
    assert.match(u.enregistrerResultat(E1, '2026-11', { modele: 'revenus', valeur: '50', ressenti: 'Trop bien' }).erreur, /Sans revenus/);
    const r = u.enregistrerResultat(E1, '2026-11', { modele: 'vues', valeur: '1000000', ressenti: 'Incroyable !' });
    assert.strictEqual(r.update.valeur, '1 000 000');
    assert.deepStrictEqual(u.aFaire(E1, '2026-12-02'), [], 'les deux sont faites : plus de rappel');
    const post = u.post(r.update, { nom: 'Awa', discordId: E1 });
    assert.strictEqual(post.titre, '🔥 Awa : 1 000 000 vues sur une seule vidéo');
    assert.match(post.texte, /<@700000000000000051> — plus gros résultat de novembre 2026[\s\S]*Incroyable/);
    // Un autre mois, avec revenus : les 3 questions.
    assert.match(u.enregistrerRevenus(E1, '2026-12', { aGagne: true, montant: '1250', reponses: { debut: 'En juin' } }).erreur, /Réponds à la question/);
    const ok = u.enregistrerRevenus(E1, '2026-12', { aGagne: true, montant: '1 250', reponses: { debut: 'En juin', conseil: 'Sois régulier', objectif: '$5 000' } });
    assert.strictEqual(ok.update.montant, 1250);
    assert.match(u.post(ok.update, { nom: 'Awa', discordId: E1 }).titre, /💰 Awa : \$1,250 en décembre 2026/);
  } finally { await m.fermer(); }
});

test('Bob publie : résultat de vidéo (une fois) et monétisation dans le salon des résultats ; updates du mois dans le forum Testimonials', async () => {
  const m = await monter();
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    const salon = []; const forum = [];
    const client = { isReady: () => true, users: { fetch: async () => ({ send: async () => true }) },
      channels: { fetch: async (id) => (id === m.config.discord.salonResultats ? { send: async (x) => salon.push(x) }
        : id === m.config.discord.forumTestimonials ? { threads: { create: async (x) => { forum.push(x); return { id: 'POST1' }; } } } : null) } };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, suivi: m.suivi, client });
    const p = m.parcours.get(E1);
    const v = { id: 7, discord_id: E1, jour: '2026-11-26', lien: 'https://www.tiktok.com/@awa/video/1', res_vues: 12400, res_abonnes: 350, res_revenus: 4.2, res_rpm: 0.8, res_captures: '[]' };
    await bob.parcours.resultatPublic(v, p);
    await bob.parcours.resultatPublic(v, p);
    assert.strictEqual(salon.length, 1, 'publié une seule fois');
    assert.match(salon[0].content, /🎬 <@700000000000000051> : résultats de sa vidéo du [\s\S]*12 400 vues · \+350 abonnés · \$4\.20 · RPM \$0\.80[\s\S]*tiktok\.com/);
    await bob.parcours.monetisationPublique({ ...p, monetisation_etat: 'envoyee_acceptee', monetisation_le: '2026-11-27' });
    assert.match(salon[1].content, /accepté dans le programme de monétisation/);
    const u = creerUpdatesMois({ db: m.db });
    const r = u.enregistrerResultat(E1, '2026-11', { modele: 'abonnes', valeur: '2500', ressenti: 'Je n\'y croyais pas.' }).update;
    await bob.parcours.updateMoisPublique(r, p, 'Awa');
    assert.strictEqual(forum[0].name, '🔥 Awa : 2 500 abonnés gagnés en une seule vidéo');
    assert.match(forum[0].message.content, /Je n'y croyais pas/);
    assert.strictEqual(u.etat(E1, '2026-11').resultat.discord_post, 'POST1');
  } finally { await m.fermer(); }
});

test('page des updates du mois : fermée hors du 28 au 5 ; résultat de vidéo envoyé → publié', async () => {
  const appels = [];
  const m = await monter({ bob: { parcours: new Proxy({}, { get: (o, nom) => async (...a) => { appels.push([nom, ...a]); return true; } }) } });
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    m.parcours.changerEtape(E1, 4);
    const page = await (await m.get('/parcours/mois', { cookie: cookieSession(E1, 'awa_27') })).text();
    assert.match(page, /Updates du mois/);
  } finally { await m.fermer(); }
});

test('serveur gratuit : liens des salons collés dans Gestion ; Bob y publie aussi (prénom, sans mention, lien vers l\'accompagnement)', async () => {
  const { ADMIN } = require('./aide');
  const m = await monter();
  try {
    const coach = { cookie: cookieSession(ADMIN, 'coach') };
    const r0 = await m.poster('/admin/discord/salons', { salon_resultats: 'n\'importe quoi', forum_testimonials: '' }, coach);
    assert.match(r0.headers.get('location'), /erreur=/);
    await m.poster('/admin/discord/salons', { salon_resultats: 'https://discord.com/channels/111111111111111111/222222222222222222', forum_testimonials: 'https://discord.com/channels/111111111111111111/333333333333333333' }, coach);
    assert.strictEqual(m.db.prepare("SELECT valeur FROM reglages WHERE cle = 'salon_resultats_gratuit'").get().valeur, '222222222222222222');
    assert.match(await (await m.get('/admin/gestion', coach)).text(), /Gestion/);
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    const recu = {};
    const salon = (id) => ({ send: async (x) => { (recu[id] = recu[id] || []).push(x); }, threads: { create: async (x) => { (recu[id] = recu[id] || []).push(x); return { id: `P${id}` }; } } });
    const client = { isReady: () => true, users: { fetch: async () => ({ send: async () => true }) }, channels: { fetch: async (id) => salon(id) } };
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, suivi: m.suivi, client });
    const p = m.parcours.get(E1);
    await bob.parcours.resultatPublic({ id: 9, discord_id: E1, jour: '2026-11-26', lien: 'https://www.tiktok.com/@awa/video/1', res_vues: 5000, res_captures: '[]' }, p);
    assert.match(recu[m.config.discord.salonResultats][0].content, /<@700000000000000051>/);
    const g = recu['222222222222222222'][0];
    assert.doesNotMatch(g.content, /<@/);
    assert.match(g.content, /\*\*awa_27\*\* \(élève Overmaxx\)[\s\S]*Toi aussi, rejoins l'accompagnement/);
    const u = creerUpdatesMois({ db: m.db }).enregistrerResultat(E1, '2026-11', { modele: 'vues', valeur: '20000', ressenti: 'Top.' }).update;
    await bob.parcours.updateMoisPublique(u, p, 'Awa');
    assert.ok(recu['333333333333333333'][0].name.includes('Awa'));
  } finally { await m.fermer(); }
});
