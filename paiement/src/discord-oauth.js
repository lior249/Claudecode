'use strict';

const crypto = require('crypto');

const API = 'https://discord.com/api/v10';

// Petit jeton signé (HMAC) : state OAuth, session de connexion. Infalsifiable sans APP_SECRET.
function signer(objet, secret) {
  const corps = Buffer.from(JSON.stringify(objet)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`jeton:${corps}`).digest('base64url');
  return `${corps}.${sig}`;
}

function verifier(jeton, secret, maintenant = Date.now()) {
  if (typeof jeton !== 'string' || jeton.length > 2000 || !jeton.includes('.')) return null;
  const [corps, sig] = jeton.split('.');
  const attendu = crypto.createHmac('sha256', secret).update(`jeton:${corps}`).digest('base64url');
  const a = Buffer.from(String(sig));
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const objet = JSON.parse(Buffer.from(corps, 'base64url').toString());
    if (objet.exp && objet.exp < maintenant) return null;
    return objet;
  } catch { return null; }
}

function creerDiscordOAuth(config, fetchImpl = fetch) {
  const { clientId, clientSecret, serveurId, jetonBot } = config.discord;
  const redirection = `${config.baseUrl}/discord/callback`;

  async function api(methode, chemin, { bot, bearer, corps, formulaire } = {}) {
    const headers = {};
    if (bot) headers.Authorization = `Bot ${jetonBot}`;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    let body;
    if (formulaire) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(formulaire); }
    if (corps) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(corps); }
    const r = await fetchImpl(API + chemin, { method: methode, headers, body, signal: AbortSignal.timeout(10000) });
    const texte = await r.text();
    if (!r.ok) {
      const err = new Error(`Discord ${methode} ${chemin} → HTTP ${r.status} : ${texte.slice(0, 200)}`);
      err.status = r.status;
      throw err;
    }
    return texte ? JSON.parse(texte) : null;
  }

  return {
    // but : 'lier' (après paiement, ajoute au serveur) ou 'connexion' (coaching, admin).
    urlAutorisation(state, { rejoindre = false } = {}) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirection,
        response_type: 'code',
        scope: rejoindre ? 'identify guilds.join' : 'identify',
        state: signer({ ...state, exp: Date.now() + 2 * 3600 * 1000 }, config.secretApp),
        prompt: 'none',
      });
      return `https://discord.com/oauth2/authorize?${params}`;
    },

    lireState(state) {
      return verifier(state, config.secretApp);
    },

    // Code reçu au retour → jeton d'accès + utilisateur Discord.
    async identifier(code) {
      const jeton = await api('POST', '/oauth2/token', {
        formulaire: { client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirection },
      });
      const u = await api('GET', '/users/@me', { bearer: jeton.access_token });
      return { accessToken: jeton.access_token, id: u.id, pseudo: u.global_name || u.username };
    },

    // Rôles du membre sur le serveur (null s'il n'y est pas).
    async rolesSurServeur(userId) {
      try {
        const m = await api('GET', `/guilds/${serveurId}/members/${userId}`, { bot: true });
        return m.roles || [];
      } catch (err) {
        if (err.status === 404) return null;
        throw err;
      }
    },

    async retirerRole(userId, roleId) {
      if (!roleId) return;
      try { await api('DELETE', `/guilds/${serveurId}/members/${userId}/roles/${roleId}`, { bot: true }); } catch (err) { if (err.status !== 404) throw err; }
    },

    // Ajoute le membre au serveur avec ses rôles (ou ajoute seulement les rôles s'il y est déjà).
    async ajouterAuServeur(userId, accessToken, roles = []) {
      const r = roles.filter(Boolean);
      const res = await api('PUT', `/guilds/${serveurId}/members/${userId}`, { bot: true, corps: { access_token: accessToken, roles: r } });
      if (res === null) {
        // Déjà membre (HTTP 204) : on ajoute les rôles un par un.
        for (const role of r) await api('PUT', `/guilds/${serveurId}/members/${userId}/roles/${role}`, { bot: true });
      }
    },
  };
}

// Session de connexion (coaching, admin), dans un cookie signé.
const COOKIE = 'ovx_session';

function lireSession(req, secret) {
  const brut = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return brut ? verifier(decodeURIComponent(brut.slice(COOKIE.length + 1)), secret) : null;
}

function ouvrirSession(res, utilisateur, config) {
  // Connexion gardée 30 jours sur l'appareil.
  const duree = 30 * 24 * 3600 * 1000;
  const jeton = signer({ id: utilisateur.id, pseudo: utilisateur.pseudo, exp: Date.now() + duree }, config.secretApp);
  res.cookie(COOKIE, jeton, {
    httpOnly: true, sameSite: 'lax', secure: config.baseUrl.startsWith('https://'), maxAge: duree, path: '/',
  });
}

function fermerSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

module.exports = { creerDiscordOAuth, signer, verifier, lireSession, ouvrirSession, fermerSession };
