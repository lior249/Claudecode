'use strict';

// Toute la configuration vient des variables d'environnement (voir .env.example).
// Les URL par défaut pointent vers les SANDBOX : aucun argent réel tant que tu ne les changes pas.

function lire(nom, defaut) {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur === '') return defaut;
  return valeur;
}

function chargerConfig() {
  const config = {
    port: Number(lire('PORT', '3000')),
    baseUrl: lire('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    nomFormation: lire('NOM_FORMATION', 'Ma formation'),
    prix: lire('PRIX'), // ex : "25000"
    devise: lire('DEVISE', 'XOF'),
    pays: lire('PAYS'), // optionnel, ex : "BJ"
    contactSupport: lire('CONTACT_SUPPORT', ''),
    secretApp: lire('APP_SECRET'),

    saspay: {
      apiUrl: lire('SASPAY_API_URL', 'https://sandbox-api.saspay.me/api/v1').replace(/\/+$/, ''),
      cleApi: lire('SASPAY_API_KEY'),
      secretWebhook: lire('SASPAY_WEBHOOK_SECRET'),
      pagesRecherche: Number(lire('SASPAY_PAGES_RECHERCHE', '5')),
    },

    whop: {
      apiUrl: lire('WHOP_API_URL', 'https://sandbox-api.whop.com/api/v1').replace(/\/+$/, ''),
      cleApi: lire('WHOP_API_KEY'),
      versionApi: lire('WHOP_API_VERSION', '2026-07-01'),
      idEntreprise: lire('WHOP_COMPANY_ID'), // biz_...
      idOffre: lire('WHOP_PLAN_ID'), // plan_... (offre payante et cachée)
      deviseOffre: lire('WHOP_DEVISE_OFFRE', 'usd').toLowerCase(),
      lienAchat: lire('WHOP_LIEN_ACHAT'), // optionnel : sinon récupéré via l'API
    },

    email: {
      cleResend: lire('RESEND_API_KEY'), // optionnel
      expediteur: lire('EMAIL_EXPEDITEUR'),
    },
  };

  const manquantes = [];
  if (!config.prix || !/^\d+(\.\d{1,2})?$/.test(config.prix)) manquantes.push('PRIX (nombre, ex : 25000)');
  if (!config.secretApp || config.secretApp.length < 32) manquantes.push('APP_SECRET (32 caractères minimum)');
  if (!config.saspay.cleApi) manquantes.push('SASPAY_API_KEY');
  if (!config.saspay.secretWebhook) manquantes.push('SASPAY_WEBHOOK_SECRET');
  if (!config.whop.cleApi) manquantes.push('WHOP_API_KEY');
  if (!config.whop.idEntreprise) manquantes.push('WHOP_COMPANY_ID');
  if (!config.whop.idOffre) manquantes.push('WHOP_PLAN_ID');
  if (config.email.cleResend && !config.email.expediteur) manquantes.push('EMAIL_EXPEDITEUR (requis avec RESEND_API_KEY)');

  if (manquantes.length) {
    throw new Error('Configuration incomplète :\n - ' + manquantes.join('\n - '));
  }
  return config;
}

module.exports = { chargerConfig };
