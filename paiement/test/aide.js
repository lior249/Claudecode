'use strict';

// Outils communs aux tests : configuration, faux SasPay, faux Whop, faux Discord, serveur HTTP.
const crypto = require('crypto');
const { chargerConfig } = require('../src/config');
const { ouvrirBase, completerPrixGarantis } = require('../src/db');
const { creerCommandes } = require('../src/commandes');
const { creerCoaching } = require('../src/coaching');
const { creerApp } = require('../src/app');
const { signer } = require('../src/discord-oauth');

const SECRET_WEBHOOK = 'whsec_test';
const ADMIN = '100000000000000001';
const ROLES = { community: '200000000000000001', elite: '200000000000000002', goat: '200000000000000003', attente: '200000000000000004' };

function configTest(extra = {}) {
  const env = {
    BASE_URL: 'http://localhost', APP_SECRET: 'x'.repeat(40), DEVISE: 'XOF',
    PRIX_COMMUNITY_ENTREE: '19025', PRIX_COMMUNITY_RENOUVELLEMENT: '3280',
    PRIX_ELITE_ENTREE: '327980', PRIX_ELITE_RENOUVELLEMENT: '39360',
    WHOP_COMMUNITY_PLAN_ID: 'plan_com', WHOP_ELITE_PLAN_ID: 'plan_eli', WHOP_COMPANY_ID: 'biz_1',
    SASPAY_API_KEY: 'k', SASPAY_WEBHOOK_SECRET: SECRET_WEBHOOK, WHOP_API_KEY: 'k',
    DISCORD_CLIENT_ID: '1', DISCORD_CLIENT_SECRET: 's', DISCORD_GUILD_ID: '300000000000000001',
    DISCORD_ADMIN_ID: ADMIN, DISCORD_ROLE_COMMUNITY: ROLES.community, DISCORD_ROLE_ELITE: ROLES.elite, DISCORD_ROLE_GOAT: ROLES.goat, DISCORD_ROLE_ATTENTE: ROLES.attente,
    LIEN_DISCORD: 'https://discord.gg/test', TALLY_SIGNING_SECRET: 'tallysecret', ...extra,
  };
  const avant = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^(PRIX_|WHOP_|SASPAY_|DISCORD_|TALLY_|WISTIA_|DUREE_|COACHING_)/.test(k)) delete process.env[k];
  Object.assign(process.env, env);
  try { return chargerConfig(); } finally { process.env = avant; }
}

function signerWebhook(corps, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', SECRET_WEBHOOK).update(`${ts}.${corps}`).digest('hex');
  return { 'X-Webhook-Signature': sig, 'X-Webhook-Timestamp': String(ts) };
}

function fauxSaspay({ montantPaye, devise = 'XOF', statutTx = 'SUCCESS' } = {}) {
  const sessions = new Map();
  return {
    sessions,
    async creerSessionCheckout(c) {
      const s = { id: crypto.randomUUID(), checkout_url: `https://pay.saspay.me/${sessions.size}`, status: 'PENDING', transaction: null, ...c };
      sessions.set(s.id, s);
      return s;
    },
    payer(id, statut = 'PAID') { const s = sessions.get(id); s.status = statut; s.transaction = `tx-${id}`; return s.transaction; },
    derniere() { return [...sessions.values()].at(-1); },
    async statutSession(id) {
      const s = sessions.get(id);
      return { id, status: s.status, transaction_id: s.transaction, transaction_status: s.transaction ? statutTx : null };
    },
    async verifierPaiement(txId) {
      const s = [...sessions.values()].find((x) => x.transaction === txId);
      return { id: txId, status: statutTx, currency: devise, requested_amount: montantPaye || s.amount };
    },
    async trouverSessionParTransaction(txId) { return [...sessions.values()].find((s) => s.transaction === txId) || null; },
  };
}

function fauxWhop() {
  const demandes = new Map();
  const appels = [];
  return {
    demandes, appels,
    ajouterDemande(id, email, planId = 'plan_com', creeIlYA = 0) {
      demandes.set(id, {
        id, status: 'pending', variant_id: planId, membership_id: null, user: { username: 'u' },
        created_at: new Date(Date.now() - creeIlYA).toISOString(),
        custom_field_responses: email ? [{ question: 'Email', answer: ` ${email.toUpperCase()} ` }] : [],
      });
    },
    async lienOffre(planId) { return `https://whop.com/checkout/${planId}`; },
    async demandesEnAttente(planId) { return [...demandes.values()].filter((d) => d.status === 'pending' && d.variant_id === planId); },
    async demande(id) { return demandes.get(id); },
    async accepter(id) { appels.push(['accepter', id]); const d = demandes.get(id); d.status = 'approved'; d.membership_id = `mem_${id}`; },
    async refuser(id) { appels.push(['refuser', id]); demandes.get(id).status = 'denied'; },
    async prolonger(mem, jours) { appels.push(['prolonger', mem, jours]); },
    async annuler(mem) { appels.push(['annuler', mem]); },
    durees: { plan_com: 30, plan_eli: 90 },
    async dureeOffre(planId) { return this.durees[planId] || null; },
  };
}

function fauxOAuth(roles = {}) {
  return {
    roles,
    ajouts: [],
    urlAutorisation: (st) => `https://discord.com/oauth2/authorize?state=${signer({ ...st, exp: Date.now() + 60000 }, 'x'.repeat(40))}`,
    lireState: (s) => require('../src/discord-oauth').verifier(s, 'x'.repeat(40)),
    async identifier() { return { id: '400000000000000001', pseudo: 'awa', accessToken: 'tok' }; },
    async ajouterAuServeur(id, tok, r) { this.ajouts.push([id, r]); },
    retraits: [],
    async retirerRole(id, r) { this.retraits.push([id, r]); },
    async rolesSurServeur(id) { return roles[id] === undefined ? null : roles[id]; },
  };
}

function cookieSession(id, pseudo = 'membre') {
  return `ovx_session=${encodeURIComponent(signer({ id, pseudo, exp: Date.now() + 3600000 }, 'x'.repeat(40)))}`;
}

// Les pages (sauf l'accueil) demandent une connexion Discord : par défaut, les tests naviguent connectés avec ce compte.
const VISITEUR = '400000000000000099';
async function monter({ config = configTest(), saspay = fauxSaspay(), whop = fauxWhop(), oauth = fauxOAuth(), maintenant, bob = null, avecCandidatures = false, surPaiement, connecte = true } = {}) {
  const db = ouvrirBase(':memory:');
  completerPrixGarantis(db, config);
  const horloge = maintenant || (() => new Date());
  const commandes = creerCommandes({ db, saspay, whop, config, maintenant: horloge, surPaiement });
  const coaching = creerCoaching({ db, config, maintenant: horloge });
  const candidatures = avecCandidatures ? require('../src/candidatures').creerCandidatures({ db, config, commandes, maintenant: horloge }) : null;
  const app = creerApp({ config, commandes, whop, coaching, oauth, bob, candidatures });
  const serveur = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${serveur.address().port}`;
  const parDefaut = connecte ? { cookie: cookieSession(VISITEUR, 'visiteur') } : {};
  return {
    config, db, saspay, whop, oauth, commandes, coaching, candidatures, base,
    fermer: () => new Promise((r) => serveur.close(r)),
    poster: (chemin, champs, headers = {}) => fetch(base + chemin, {
      method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...parDefaut, ...headers }, body: new URLSearchParams(champs),
    }),
    get: (chemin, headers = {}) => fetch(base + chemin, { redirect: 'manual', headers: { ...parDefaut, ...headers } }),
    etat: async (ref) => (await fetch(`${base}/api/commandes/${ref}`)).json(),
  };
}

module.exports = { configTest, signerWebhook, fauxSaspay, fauxWhop, fauxOAuth, cookieSession, monter, ADMIN, ROLES, SECRET_WEBHOOK, VISITEUR };
