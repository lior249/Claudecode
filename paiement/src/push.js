'use strict';

// Notifications de l'application Overmaxx (notifications web, sans Discord ni store).
// - Les clés VAPID sont créées au premier démarrage et gardées dans la base : rien à régler dans overmaxx.env.
// - Un membre peut avoir plusieurs appareils (abonnements) ; un abonnement expiré (404 ou 410) est supprimé.
// - Chacun choisit où il reçoit ses messages : « bob » (Discord, par défaut) ou « app ».
// - Rappels de paiement : par Bob tout de suite, puis par l'application 10 minutes plus tard, seulement s'il n'a pas payé.

const webpush = require('web-push');

// Seuls les services de notification des navigateurs sont acceptés comme destinataires.
const SERVICES = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

function abonnementValide(a) {
  if (!a || typeof a.endpoint !== 'string' || a.endpoint.length > 1000 || !a.keys) return false;
  let u;
  try { u = new URL(a.endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || !SERVICES.some((r) => r.test(u.hostname))) return false;
  const { p256dh, auth } = a.keys;
  return typeof p256dh === 'string' && typeof auth === 'string' && BASE64URL.test(p256dh) && BASE64URL.test(auth)
    && p256dh.length >= 80 && p256dh.length <= 100 && auth.length >= 16 && auth.length <= 32;
}

function creerPush({ db, config, maintenant = () => new Date(), envoyerPush = (...a) => webpush.sendNotification(...a) } = {}) {
  const q = {
    reglage: db.prepare('SELECT valeur FROM reglages WHERE cle = ?'),
    majReglage: db.prepare('INSERT INTO reglages (cle, valeur, maj_le) VALUES (?, ?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, maj_le = excluded.maj_le'),
    abonner: db.prepare(`INSERT INTO abonnements_push (endpoint, discord_id, p256dh, auth, appareil, cree_le, vu_le) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET discord_id = excluded.discord_id, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil, vu_le = excluded.vu_le, erreurs = 0`),
    abonnements: db.prepare('SELECT * FROM abonnements_push WHERE discord_id = ? ORDER BY cree_le'),
    supprimer: db.prepare('DELETE FROM abonnements_push WHERE endpoint = ?'),
    supprimerDe: db.prepare('DELETE FROM abonnements_push WHERE endpoint = ? AND discord_id = ?'),
    vu: db.prepare('UPDATE abonnements_push SET vu_le = ?, erreurs = 0 WHERE endpoint = ?'),
    erreur: db.prepare('UPDATE abonnements_push SET erreurs = erreurs + 1 WHERE endpoint = ?'),
    canal: db.prepare('SELECT canal FROM preferences_notif WHERE discord_id = ?'),
    majCanal: db.prepare('INSERT INTO preferences_notif (discord_id, canal, maj_le) VALUES (?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET canal = excluded.canal, maj_le = excluded.maj_le'),
    differer: db.prepare(`INSERT INTO notifications_differees (discord_id, titre, corps, url, membre_id, acces_avant, envoyer_apres, cree_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    dues: db.prepare('SELECT * FROM notifications_differees WHERE envoye_le IS NULL AND envoyer_apres <= ? ORDER BY id LIMIT 50'),
    marquer: db.prepare('UPDATE notifications_differees SET envoye_le = ?, resultat = ? WHERE id = ?'),
  };
  const iso = () => maintenant().toISOString();
  // L'identité de l'expéditeur des notifications (VAPID) : l'adresse du site.
  const sujet = /^https:\/\//.test(config.baseUrl || '') ? config.baseUrl : 'https://overmaxx.online';

  function cles() {
    const r = q.reglage.get('vapid');
    if (r) return JSON.parse(r.valeur);
    const k = webpush.generateVAPIDKeys();
    q.majReglage.run('vapid', JSON.stringify(k), iso());
    return k;
  }

  const api = {
    clePublique() { return cles().publicKey; },

    abonner(discordId, abonnement, appareil = '') {
      if (!abonnementValide(abonnement)) return { erreur: 'Abonnement aux notifications invalide.' };
      q.abonner.run(abonnement.endpoint, discordId, abonnement.keys.p256dh, abonnement.keys.auth, String(appareil || '').slice(0, 80), iso(), iso());
      return { ok: true };
    },
    desabonner(discordId, endpoint) { return q.supprimerDe.run(String(endpoint || ''), discordId).changes > 0; },
    abonnements(discordId) { return q.abonnements.all(discordId); },

    canal(discordId) { const r = q.canal.get(discordId); return (r && r.canal) || 'bob'; },
    choisirCanal(discordId, canal) {
      if (!['bob', 'app'].includes(canal)) return { erreur: 'Choix inconnu.' };
      if (canal === 'app' && !q.abonnements.all(discordId).length) return { erreur: 'Active d\'abord les notifications sur ce téléphone.' };
      q.majCanal.run(discordId, canal, iso());
      return { ok: true };
    },

    // Envoie à tous ses appareils. Renvoie le nombre d'appareils atteints.
    async envoyer(discordId, { titre, corps, url, tag, compte }) {
      const k = cles();
      const charge = JSON.stringify({ titre: String(titre || 'Overmaxx').slice(0, 100), corps: String(corps || '').slice(0, 300), url: url || '/app', tag: tag || undefined,
        compte: Number.isInteger(compte) && compte >= 0 ? compte : undefined });
      let n = 0;
      for (const s of q.abonnements.all(discordId)) {
        try {
          await envoyerPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, charge,
            { vapidDetails: { subject: sujet, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 24 * 3600, urgency: 'high', timeout: 10000 });
          q.vu.run(iso(), s.endpoint);
          n++;
        } catch (err) {
          if (err && [404, 410].includes(err.statusCode)) q.supprimer.run(s.endpoint); // appareil désinstallé ou notifications coupées
          else { q.erreur.run(s.endpoint); console.warn('[push] envoi impossible :', (err && (err.statusCode || err.message)) || err); }
        }
      }
      return n;
    },

    // Notification à envoyer plus tard (rappel de paiement), annulée s'il a payé entre-temps.
    differer(discordId, { titre, corps, url }, { minutes = 10, membreId = null, accesAvant = null } = {}) {
      const quand = new Date(maintenant().getTime() + minutes * 60 * 1000).toISOString();
      q.differer.run(discordId, String(titre || 'Overmaxx').slice(0, 100), String(corps || '').slice(0, 300), url || '/app', membreId, accesAvant, quand, iso());
    },
    dues() { return q.dues.all(iso()); },
    marquerDifferee(id, resultat) { q.marquer.run(iso(), resultat, id); },
  };
  return api;
}

module.exports = { creerPush, abonnementValide };
