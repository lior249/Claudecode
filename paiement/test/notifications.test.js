'use strict';

// Livraison 4 : l'application installable (manifeste, service worker, ouverture déjà connectée)
// et ses notifications (choix Bob ou application, repli sur Bob, rappels de paiement 10 minutes après Bob).

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const webpush = require('web-push');
const { monter, cookieSession, ADMIN } = require('./aide');
const { creerPush, abonnementValide } = require('../src/push');
const { creerBob } = require('../src/bob');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const E1 = '700000000000000021';
// Un vrai abonnement de navigateur (clés de chiffrement générées comme le ferait le téléphone).
function abonnementFaux(hote = 'fcm.googleapis.com') {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint: `https://${hote}/fcm/send/${crypto.randomBytes(8).toString('hex')}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
}
const attendre = () => new Promise((r) => setTimeout(r, 30));

test('notifications : clés gardées dans la base, abonnements contrôlés, choix du canal, appareil expiré supprimé, requête chiffrée', async () => {
  const m = await monter();
  try {
    const envois = [];
    let reponse = null;
    const push = creerPush({ db: m.db, config: m.config, envoyerPush: async (abo, charge, options) => {
      envois.push({ abo, charge: JSON.parse(charge), options });
      if (reponse) { const e = new Error('expiré'); e.statusCode = reponse; throw e; }
    } });
    const cle = push.clePublique();
    assert.strictEqual(creerPush({ db: m.db, config: m.config }).clePublique(), cle, 'mêmes clés après un redémarrage');

    assert.ok(!abonnementValide(abonnementFaux('exemple.com')), 'seuls les services de notification des navigateurs');
    assert.ok(!abonnementValide({ endpoint: 'http://fcm.googleapis.com/x', keys: abonnementFaux().keys }));
    assert.ok(abonnementValide(abonnementFaux('web.push.apple.com')));
    assert.match(push.choisirCanal(E1, 'app').erreur, /Active d'abord/);
    assert.strictEqual(push.canal(E1), 'bob', 'Bob par défaut');
    const a1 = abonnementFaux(); const a2 = abonnementFaux('updates.push.services.mozilla.com');
    assert.ok(push.abonner(E1, a1, 'Android · application').ok);
    assert.ok(push.abonner(E1, a2, 'Windows · Firefox').ok);
    assert.ok(push.choisirCanal(E1, 'app').ok);
    assert.strictEqual(push.canal(E1), 'app');

    assert.strictEqual(await push.envoyer(E1, { titre: 'Bonjour', corps: 'Test', url: '/parcours' }), 2);
    assert.deepStrictEqual(envois[0].charge, { titre: 'Bonjour', corps: 'Test', url: '/parcours' });
    assert.strictEqual(envois[0].options.vapidDetails.publicKey, cle);
    assert.match(envois[0].options.vapidDetails.subject, /^https:\/\//);
    reponse = 410;
    assert.strictEqual(await push.envoyer(E1, { titre: 'x' }), 0);
    assert.strictEqual(push.abonnements(E1).length, 0, 'appareils désinstallés : supprimés');

    // La vraie requête (chiffrée) que le site enverrait au service de notification.
    const d = webpush.generateRequestDetails(a1, JSON.stringify({ titre: 'x' }), envois[0].options);
    assert.strictEqual(d.headers['Content-Encoding'], 'aes128gcm');
    assert.match(d.headers.Authorization, /^vapid t=.+, k=/);
    assert.strictEqual(d.endpoint, a1.endpoint);
  } finally { await m.fermer(); }
});

test('application installable : manifeste, service worker, ouverture déjà connectée, page Notifications', async () => {
  const m = await monter();
  try {
    m.parcours.assurer(E1, { pseudo: 'awa_27' });
    const membre = cookieSession(E1, 'awa_27');
    const accueil = await (await m.get('/', { cookie: '' })).text();
    assert.match(accueil, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    const manif = await (await m.get('/manifest.webmanifest', { cookie: '' })).json();
    assert.strictEqual(manif.display, 'standalone');
    assert.strictEqual(manif.start_url, '/app');
    assert.ok(manif.icons.some((i) => i.purpose === 'maskable'));
    const sw = await m.get('/sw.js');
    assert.match(sw.headers.get('content-type'), /javascript/);
    assert.match(await sw.text(), /addEventListener\('push'/);
    assert.strictEqual((await m.get('/static/icones/globe-512.png')).status, 200);

    // Connecté : le manifeste de la page porte son jeton ; l'application installée s'ouvre déjà connectée.
    const page = await (await m.get('/parcours', { cookie: membre })).text();
    const u = decodeURIComponent(page.match(/manifest\.webmanifest\?u=([^"]+)"/)[1]);
    const perso = await (await m.get(`/manifest.webmanifest?u=${encodeURIComponent(u)}`, { cookie: '' })).json();
    assert.ok(perso.start_url.startsWith('/app?t='));
    const ouverture = await m.get(perso.start_url, { cookie: '' });
    assert.strictEqual(ouverture.headers.get('location'), '/bienvenue', 'premier passage : l\'accueil des nouveaux');
    assert.match(ouverture.headers.get('set-cookie') || '', /ovx_session=/);
    assert.strictEqual((await m.get('/app?t=faux', { cookie: '' })).headers.get('location'), '/');
    assert.strictEqual((await m.get('/app', { cookie: cookieSession(ADMIN, 'coach') })).headers.get('location'), '/admin/a-traiter');

    // Page d'accueil connecté : « Ouvrir mon espace ». Bouton de Bob après « Se connecter » : son espace s'ouvre.
    assert.match(await (await m.get('/', { cookie: membre })).text(), /Bon retour, awa_27[\s\S]*href="\/bienvenue">Ouvrir mon espace/);
    const { lienMagique } = require('../src/liens');
    const bouton = await m.get(new URL(lienMagique(m.config, { id: E1, pseudo: 'awa_27' }, '/app')).pathname + new URL(lienMagique(m.config, { id: E1, pseudo: 'awa_27' }, '/app')).search, { cookie: '' });
    assert.strictEqual(bouton.headers.get('location'), '/app');
    const cookieBob = bouton.headers.get('set-cookie').split(';')[0];
    assert.strictEqual((await m.get('/app', { cookie: cookieBob })).headers.get('location'), '/bienvenue');

    // Accueil des nouveaux : infos, application, notifications ; ensuite, son espace directement.
    const pageBienvenue = await (await m.get('/bienvenue', { cookie: membre })).text();
    assert.match(pageBienvenue, /Bienvenue, awa_27/);
    assert.match(pageBienvenue, /Tes informations[\s\S]*L'application Overmaxx[\s\S]*Tes notifications[\s\S]*Tout est prêt/);
    const poste = (chemin, corps) => fetch(`${m.base}${chemin}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: membre }, body: JSON.stringify(corps) });
    assert.strictEqual((await poste('/api/bienvenue/infos', { prenom: 'A', pays: 'Togo' })).status, 400);
    assert.strictEqual((await poste('/api/bienvenue/infos', { prenom: 'Awa', pays: 'Togo', fuseau: 'Africa/Lome' })).status, 200);
    assert.strictEqual(m.coaching.profil(E1).fuseau, 'Africa/Lome');
    // Mon parcours : la fenêtre « Ce qu'il te reste à faire », avec l'accueil à terminer.
    const parcoursPage = await (await m.get('/parcours', { cookie: membre })).text();
    assert.match(parcoursPage, /<dialog class="fenetre" id="a-faire"/);
    assert.match(parcoursPage, /Termine ton accueil[\s\S]*Envoie tes exercices L1 et L2/);
    assert.strictEqual((await poste('/api/bienvenue/fini', {})).status, 200);
    assert.strictEqual((await m.get('/app', { cookie: membre })).headers.get('location'), '/profil');
    assert.doesNotMatch(await (await m.get('/parcours', { cookie: membre })).text(), /Termine ton accueil/);
    // Le réglage Discord pour que Bob puisse écrire : sur la page d'accueil, avec les 4 captures.
    const visiteur = await (await m.get('/', { cookie: '' })).text();
    assert.match(visiteur, /data-tuto-bob>Rejoindre le Discord/);
    assert.match(visiteur, /Avant de rejoindre le Discord[\s\S]*Contenu et social[\s\S]*Messages privés et demandes d'ami/);
    for (let i = 1; i <= 4; i++) assert.strictEqual((await m.get(`/static/aide/bob-${i}.jpg`)).status, 200);

    // Page Notifications et ses appels.
    const notif = await (await m.get('/notifications', { cookie: membre })).text();
    assert.match(notif, /Où recevoir mes notifications/);
    assert.match(notif, /Sur l'écran d'accueil/);
    const api = (chemin, corps, cookie = membre) => fetch(`${m.base}${chemin}`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(corps) });
    assert.strictEqual((await api('/api/notifications/canal', { canal: 'app' })).status, 400, 'pas encore d\'appareil');
    assert.strictEqual((await api('/api/notifications/abonnement', { abonnement: abonnementFaux('exemple.com') })).status, 400);
    const a = abonnementFaux();
    assert.strictEqual((await api('/api/notifications/abonnement', { abonnement: a, appareil: 'Android · application' })).status, 200);
    assert.strictEqual((await api('/api/notifications/canal', { canal: 'app' })).status, 200);
    const t = await (await api('/api/notifications/test', {})).json();
    assert.strictEqual(t.appareils, 1);
    assert.strictEqual(m.envoisPush[0][1].titre, 'Notifications activées');
    assert.match(await (await m.get('/notifications', { cookie: membre })).text(), /Android · application/);
    assert.strictEqual((await api('/api/notifications/test', {}, '')).status, 401);
    // Plus aucun appareil : Bob reprend.
    assert.strictEqual((await api('/api/notifications/desabonnement', { endpoint: a.endpoint })).status, 200);
    assert.strictEqual(m.push.canal(E1), 'bob');
  } finally { await m.fermer(); }
});

test('Bob : messages dans l\'application selon le choix, repli sur Discord, boutons d\'action sur Discord, rappels de paiement 10 min après', async () => {
  let now = new Date('2026-11-23T09:00:00Z');
  const m = await monter({ maintenant: () => now });
  try {
    const dms = [];
    const bob = creerBob({ config: m.config, db: m.db, commandes: m.commandes, coaching: m.coaching, parcours: m.parcours, push: m.push, maintenant: () => now,
      client: { isReady: () => true, users: { fetch: async (id) => ({ send: async (c) => dms.push([id, c.content, c.components]) }) } } });
    const ligne = (...b) => new ActionRowBuilder().addComponents(...b);

    // Conversion d'un message de Bob en notification.
    const n = bob.versPush({ content: '**Ton coach a ajouté une remarque sur ta fiche.** Va la lire <@123>.',
      components: [ligne(new ButtonBuilder().setLabel('Lire').setStyle(ButtonStyle.Link).setURL('https://overmaxx.online/fiche'))] });
    assert.deepStrictEqual(n, { titre: 'Ton coach a ajouté une remarque sur ta fiche', corps: 'Va la lire.', url: 'https://overmaxx.online/fiche' });

    // Choix « application » : le message part dans l'application, pas sur Discord.
    assert.ok(m.push.abonner(E1, abonnementFaux(), 'Android').ok);
    m.push.choisirCanal(E1, 'app');
    assert.ok(await bob.notifier.membre(E1, '**Rappel** : ta séance est à 16:00.'));
    assert.strictEqual(m.envoisPush.length, 1);
    assert.strictEqual(dms.length, 0);
    // Message avec un bouton d'action (Confirmer…) : seulement sur Discord.
    m.push.abonner(ADMIN, abonnementFaux(), 'iPhone');
    m.push.choisirCanal(ADMIN, 'app');
    await bob.notifier.admin({ content: 'GOAT atteint', components: [ligne(new ButtonBuilder().setCustomId('recompense:goat:1').setLabel('Confirmer').setStyle(ButtonStyle.Success))] });
    assert.strictEqual(dms.filter(([id]) => id === ADMIN).length, 1);
    await bob.notifier.admin('**Nouveau compte rendu** à valider.');
    assert.strictEqual(m.envoisPush.length, 2, 'le coach aussi, dans l\'application');

    // Rappel de paiement (Community) : Bob tout de suite, l'application 10 minutes plus tard s'il n'a pas renouvelé.
    const { inscrire } = { inscrire: async (email) => {
      await m.poster('/community/paiement', { nom: 'Kodjo', email }, { cookie: cookieSession('P9', 'payeur') });
      m.saspay.payer(m.saspay.derniere().id);
      await m.etat(m.saspay.derniere().metadata.ref);
      const mb = m.db.prepare("SELECT * FROM membres WHERE email = ? AND programme = 'community'").get(email);
      m.db.prepare('UPDATE membres SET discord_id = ? WHERE id = ?').run(E1, mb.id);
      return m.db.prepare('SELECT * FROM membres WHERE id = ?').get(mb.id);
    } };
    const mb = await inscrire('kodjo@example.com');
    const avant = m.envoisPush.length;
    now = new Date(new Date(mb.acces_jusqu_au).getTime() - 2.5 * 86400000); // 3 derniers jours
    await bob.renouvellements();
    assert.ok(dms.some(([id, t]) => id === E1 && /Renouvelle/.test(t)), 'Bob d\'abord, même avec le choix « application »');
    await bob.notificationsDifferees();
    assert.strictEqual(m.envoisPush.length, avant, 'pas avant 10 minutes');
    now = new Date(now.getTime() + 10 * 60 * 1000 + 1000);
    await bob.notificationsDifferees();
    assert.strictEqual(m.envoisPush.length, avant + 1);
    assert.match(m.envoisPush.at(-1)[1].corps, /Renouvelle/);
    // Rappel suivant (24 h), mais il renouvelle avant les 10 minutes : rien dans l'application.
    now = new Date(new Date(mb.acces_jusqu_au).getTime() - 12 * 3600000);
    await bob.renouvellements();
    m.db.prepare('UPDATE membres SET acces_jusqu_au = ? WHERE id = ?').run(new Date(new Date(mb.acces_jusqu_au).getTime() + 30 * 86400000).toISOString(), mb.id);
    now = new Date(now.getTime() + 11 * 60 * 1000);
    await bob.notificationsDifferees();
    assert.strictEqual(m.envoisPush.length, avant + 1, 'payé entre-temps');

    // Plus aucun appareil ne répond : Bob prend le relais.
    m.db.prepare('DELETE FROM abonnements_push WHERE discord_id = ?').run(E1);
    const d = dms.length;
    await bob.notifier.membre(E1, '**Ta vidéo est validée.**');
    assert.strictEqual(dms.length, d + 1);
    await attendre();
  } finally { await m.fermer(); }
});
