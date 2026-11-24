'use strict';

// Toute la configuration vient des variables d'environnement (voir .env.example).

function lire(nom, defaut) {
  const valeur = process.env[nom];
  if (valeur === undefined || valeur === '') return defaut;
  return valeur;
}

const MONTANT = /^\d+(\.\d{1,2})?$/;
const ID_DISCORD = /^\d{15,22}$/;

function chargerConfig({ strict = true } = {}) {
  const config = {
    port: Number(lire('PORT', '3000')),
    baseUrl: lire('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    fichierBase: lire('FICHIER_BASE', './data/paiement.db'),
    nomFormation: lire('NOM_FORMATION', 'Overmaxx'),
    devise: lire('DEVISE', 'XOF'),
    pays: lire('PAYS'),
    lienDiscord: lire('LIEN_DISCORD', ''),
    contactSupport: lire('CONTACT_SUPPORT', ''),
    secretApp: lire('APP_SECRET'),

    // Les deux offres. Les anciens noms (PRIX_INSCRIPTION, PRIX_MENSUEL, WHOP_PLAN_ID…) restent acceptés.
    offres: {
      community: {
        id: 'community',
        nom: lire('NOM_COMMUNITY', 'Overmaxx Community'),
        prixEntree: lire('PRIX_COMMUNITY_ENTREE', lire('PRIX_INSCRIPTION')),
        prixRenouvellement: lire('PRIX_COMMUNITY_RENOUVELLEMENT', lire('PRIX_MENSUEL')),
        dureeJours: Number(lire('DUREE_COMMUNITY_JOURS', lire('DUREE_ACCES_JOURS', '30'))),
        whopPlanId: lire('WHOP_COMMUNITY_PLAN_ID', lire('WHOP_PLAN_ID')),
        roleDiscord: lire('DISCORD_ROLE_COMMUNITY'),
        wistiaGuide: lire('WISTIA_GUIDE_COMMUNITY', lire('WISTIA_MEDIA_ID', '')),
        graceJours: Number(lire('ATTENTE_COMMUNITY_JOURS', '15')), // jours en « Attente » avant le retrait du serveur
        base: '/community',
      },
      elite: {
        id: 'elite',
        nom: lire('NOM_ELITE', 'Overmaxx Elite'),
        prixEntree: lire('PRIX_ELITE_ENTREE', '327980'),
        prixRenouvellement: lire('PRIX_ELITE_RENOUVELLEMENT', '39360'),
        dureeJours: Number(lire('DUREE_ELITE_JOURS', '90')),
        whopPlanId: lire('WHOP_ELITE_PLAN_ID'),
        roleDiscord: lire('DISCORD_ROLE_ELITE'),
        wistiaGuide: lire('WISTIA_GUIDE_ELITE', ''),
        wistiaVsl: lire('WISTIA_VSL_ELITE', ''),
        tallyFormId: lire('TALLY_FORM_ID', ''),
        graceJours: 0, // Elite : retrait immédiat à la fin
        base: '/coaching/elite',
      },
    },

    saspay: {
      apiUrl: lire('SASPAY_API_URL', 'https://api.saspay.me/api/v1').replace(/\/+$/, ''),
      cleApi: lire('SASPAY_API_KEY'),
      secretWebhook: lire('SASPAY_WEBHOOK_SECRET'),
      pagesRecherche: Number(lire('SASPAY_PAGES_RECHERCHE', '5')),
    },

    whop: {
      apiUrl: lire('WHOP_API_URL', 'https://api.whop.com/api/v1').replace(/\/+$/, ''),
      cleApi: lire('WHOP_API_KEY'),
      versionApi: lire('WHOP_API_VERSION', '2026-07-01'),
      idEntreprise: lire('WHOP_COMPANY_ID'),
      refusApresHeures: Number(lire('WHOP_REFUS_APRES_HEURES', '48')),
    },

    discord: {
      jetonBot: lire('DISCORD_BOT_TOKEN'),
      clientId: lire('DISCORD_CLIENT_ID'),
      clientSecret: lire('DISCORD_CLIENT_SECRET'),
      serveurId: lire('DISCORD_GUILD_ID'),
      roleGoat: lire('DISCORD_ROLE_GOAT'),
      roleAttente: lire('DISCORD_ROLE_ATTENTE'),
      // Nouveaux venus « En Attente » sans programme : retirés du serveur après ce délai.
      attenteNouveauxHeures: Number(lire('ATTENTE_NOUVEAUX_HEURES', '24')),
      adminId: lire('DISCORD_ADMIN_ID'),
      salonCoaching: lire('DISCORD_SALON_COACHING_URL', ''),
      // Salon d'attente existant (identifiant). Vide : Bob crée #en-attente tout seul au démarrage.
      salonAttente: lire('DISCORD_SALON_ATTENTE_ID', ''),
    },

    tally: { secret: lire('TALLY_SIGNING_SECRET', '') },
    videoMaxMo: Number(lire('VIDEO_MAX_MO', '20')),

    coaching: {
      // Heures GMT des créneaux de 30 minutes.
      creneaux: lire('COACHING_CRENEAUX', '15:00,15:30,16:00,16:30,17:00,17:30,21:00,21:30,22:00,22:30').split(',').map((s) => s.trim()),
      minParSemaine: Number(lire('COACHING_MIN_PAR_SEMAINE', '4')),
      delaiReservationHeures: Number(lire('COACHING_DELAI_HEURES', '4')),
      annulationMinutes: Number(lire('COACHING_ANNULATION_MINUTES', '30')),
      rappelAdminHeures: Number(lire('COACHING_RAPPEL_ADMIN_HEURES', '2')),
    },

    email: {
      cleResend: lire('RESEND_API_KEY'),
      expediteur: lire('EMAIL_EXPEDITEUR'),
    },
  };

  // Compatibilité : anciennes pages et anciens tests.
  config.prixInscription = config.offres.community.prixEntree;
  config.prixMensuel = config.offres.community.prixRenouvellement;
  config.dureeAccesJours = config.offres.community.dureeJours;
  config.wistiaId = config.offres.community.wistiaGuide;
  config.discordActif = Boolean(config.discord.jetonBot && config.discord.serveurId);
  config.oauthActif = Boolean(config.discord.clientId && config.discord.clientSecret && config.discord.serveurId);

  if (!strict) return config;

  const manquantes = [];
  for (const o of Object.values(config.offres)) {
    if (!MONTANT.test(o.prixEntree || '')) manquantes.push(`prix d'entrée ${o.id} (PRIX_${o.id.toUpperCase()}_ENTREE)`);
    if (!MONTANT.test(o.prixRenouvellement || '')) manquantes.push(`prix de renouvellement ${o.id} (PRIX_${o.id.toUpperCase()}_RENOUVELLEMENT)`);
    if (!(o.dureeJours > 0)) manquantes.push(`durée ${o.id}`);
  }
  if (!config.offres.community.whopPlanId) manquantes.push('WHOP_COMMUNITY_PLAN_ID');
  if (!config.secretApp || config.secretApp.length < 32) manquantes.push('APP_SECRET (32 caractères minimum)');
  if (!config.saspay.cleApi) manquantes.push('SASPAY_API_KEY');
  if (!config.saspay.secretWebhook) manquantes.push('SASPAY_WEBHOOK_SECRET');
  if (!config.whop.cleApi) manquantes.push('WHOP_API_KEY');
  if (!config.whop.idEntreprise) manquantes.push('WHOP_COMPANY_ID');
  for (const [nom, v] of [
    ['DISCORD_GUILD_ID', config.discord.serveurId], ['DISCORD_ADMIN_ID', config.discord.adminId],
    ['DISCORD_ROLE_COMMUNITY', config.offres.community.roleDiscord], ['DISCORD_ROLE_ELITE', config.offres.elite.roleDiscord],
    ['DISCORD_ROLE_GOAT', config.discord.roleGoat], ['DISCORD_ROLE_ATTENTE', config.discord.roleAttente],
  ]) {
    if (v && !ID_DISCORD.test(v)) manquantes.push(`${nom} (identifiant Discord : uniquement des chiffres)`);
  }
  if (config.email.cleResend && !config.email.expediteur) manquantes.push('EMAIL_EXPEDITEUR (requis avec RESEND_API_KEY)');

  if (manquantes.length) throw new Error('Configuration incomplète :\n - ' + manquantes.join('\n - '));
  return config;
}

module.exports = { chargerConfig };
