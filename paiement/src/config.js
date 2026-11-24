'use strict';

// Toute la configuration vient des variables d'environnement (voir .env.example).
// Les URL par défaut pointent vers les SANDBOX : aucun argent réel tant que tu ne les changes pas.

function lire(nom, defaut) {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur === '') return defaut;
  return valeur;
}

const MONTANT = /^\d+(\.\d{1,2})?$/;

function chargerConfig() {
  const config = {
    port: Number(lire('PORT', '3000')),
    baseUrl: lire('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    fichierBase: lire('FICHIER_BASE', './data/paiement.db'),
    nomFormation: lire('NOM_FORMATION', 'Ma formation'),
    devise: lire('DEVISE', 'XOF'),
    prixInscription: lire('PRIX_INSCRIPTION'), // ex : 19025 (≈ 29 €)
    prixMensuel: lire('PRIX_MENSUEL'), // ex : 3280 (≈ 5 €)
    dureeAccesJours: Number(lire('DUREE_ACCES_JOURS', '30')),
    pays: lire('PAYS'), // optionnel, ex : "BJ"
    lienDiscord: lire('LIEN_DISCORD', ''),
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
      idOffre: lire('WHOP_PLAN_ID'), // plan_... (offre cachée débloquée par le code)
      deviseOffre: lire('WHOP_DEVISE_OFFRE', 'eur').toLowerCase(),
      lienAchat: lire('WHOP_LIEN_ACHAT'), // optionnel : sinon récupéré via l'API
    },

    email: {
      cleResend: lire('RESEND_API_KEY'), // optionnel
      expediteur: lire('EMAIL_EXPEDITEUR'),
    },
  };

  const manquantes = [];
  if (!MONTANT.test(config.prixInscription || '')) manquantes.push('PRIX_INSCRIPTION (nombre, ex : 19025)');
  if (!MONTANT.test(config.prixMensuel || '')) manquantes.push('PRIX_MENSUEL (nombre, ex : 3280)');
  if (!(config.dureeAccesJours > 0)) manquantes.push('DUREE_ACCES_JOURS (nombre de jours > 0)');
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
