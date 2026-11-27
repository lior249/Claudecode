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
    // Ressources (niches, méthodes, tutoriels) : cachées pour l'instant, gardées dans la base (RESSOURCES=1 pour les rallumer).
    ressourcesActives: lire('RESSOURCES', '0') === '1',
    // Leçons de la formation (Whop) citées dans les formulaires du parcours.
    formation: {
      niche: lire('FORMATION_NICHE', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_R4oKNKL5cKzj3/'),
      compte: lire('FORMATION_COMPTE', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_9J723ZxcGblHC/'),
      partagerCompte: lire('FORMATION_PARTAGER_COMPTE', ''), // vidéo Wistia (identifiant ou lien), à venir
      monetisation: lire('FORMATION_MONETISATION', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_5t8uMg8rOVH8K/'),
      hook: lire('FORMATION_HOOK', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_7XEb7ags2m67i/'),
      engagement: lire('FORMATION_ENGAGEMENT', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_8lGEPQjK12HZd/'),
      watchtime: lire('FORMATION_WATCHTIME', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_Z90wzeJeZARZq/'),
      routine: lire('FORMATION_ROUTINE', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_DbLBvOppIKmKD/'),
      gardeCeQuiMarche: lire('FORMATION_GARDE', 'https://whop.com/overmaxx/exp_6XBW7sJB6mQQwZ/app/courses/cors_oS7MQJzspzkIe/lessons/lesn_eLc7dJw5cVt5g/'),
    },
    baseUrl: lire('BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
    fichierBase: lire('FICHIER_BASE', './data/paiement.db'),
    nomFormation: lire('NOM_FORMATION', 'Overmaxx'),
    devise: lire('DEVISE', 'XOF'),
    pays: lire('PAYS'),
    lienDiscord: lire('LIEN_DISCORD', ''),
    wistiaAccueil: lire('WISTIA_ACCUEIL', ''), // vidéo de présentation de la page d'accueil
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
        // Tutos vidéo des étapes du parcours (emplacement réservé tant qu'ils sont vides).
        wistiaEtape1: lire('WISTIA_ETAPE_1', ''),
        wistiaEtape2: lire('WISTIA_ETAPE_2', ''),
        wistiaEtape3: lire('WISTIA_ETAPE_3', ''),
        wistiaEtape4: lire('WISTIA_ETAPE_4', ''),
        wistiaGoat: lire('WISTIA_GOAT', ''), // vidéo de félicitations GOAT (fenêtre « Ce qu'il te reste à faire »)
        // Paiement par carte : lien de l'offre Whop cachée (même prix). Proposé à côté du mobile money après validation.
        lienCarte: lire('LIEN_CARTE_ELITE', 'https://whop.com/overmaxx/legroupe-secret-accompagnement-prive/'),
        // La formation sur Whop (lien https de Whop : s'ouvre dans l'application Whop si elle est installée).
        lienFormation: lire('LIEN_FORMATION_WHOP', lire('LIEN_CARTE_ELITE', 'https://whop.com/overmaxx/legroupe-secret-accompagnement-prive/')),
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
      // Rôles de l'accompagnement Elite (docs/ACCOMPAGNEMENT-ELITE.md) : identifiants du serveur Overmaxx par défaut.
      roleGoat: lire('DISCORD_ROLE_GOAT', '1574770119178195024'),
      roleSinistre: lire('DISCORD_ROLE_SINISTRE', '1573304134138855585'),
      rolesRevenus: {
        1500: lire('DISCORD_ROLE_1500', '1573303409455407274'),
        5000: lire('DISCORD_ROLE_5000', '1573303677106520227'),
        10000: lire('DISCORD_ROLE_10000', '1573303848003571733'),
      },
      // Salon #sinistrés existant (identifiant). Vide : Bob le crée tout seul au démarrage.
      salonSinistres: lire('DISCORD_SALON_SINISTRES_ID', ''),
      roleAttente: lire('DISCORD_ROLE_ATTENTE'),
      // Deux serveurs : celui de Bob (DISCORD_GUILD_ID) est réservé aux membres payants (Community, Elite) ;
      // l'ancien serveur devient le serveur gratuit / d'attente (candidats, accès expirés). Bob doit y être invité.
      serveurAttenteId: lire('DISCORD_GUILD_ATTENTE_ID', ''),
      roleAttenteAncien: lire('DISCORD_ROLE_ATTENTE_ANCIEN', ''),   // rôle donné sur l'ancien serveur (facultatif)
      lienMembres: lire('DISCORD_INVITE_MEMBRES', ''),             // invitation au serveur membres (après paiement)
      // Nouveaux venus « En Attente » sans programme : retirés du serveur après ce délai (0 = jamais).
      // Avec un serveur d'attente, 24 h par défaut : le serveur membres n'est que pour ceux qui ont payé.
      attenteNouveauxHeures: Number(lire('ATTENTE_NOUVEAUX_HEURES', lire('DISCORD_GUILD_ATTENTE_ID', '') ? '24' : '0')),
      attenteNouveauxHeuresChoisi: lire('ATTENTE_NOUVEAUX_HEURES', '') !== '',
      adminId: lire('DISCORD_ADMIN_ID'),
      salonCoaching: lire('DISCORD_SALON_COACHING_URL', 'https://discord.com/channels/1573126841491787916/1573298701202362398'),
      // Résultats publiés par Bob sur le serveur de l'accompagnement : le salon des résultats (vidéos, monétisation)
      // et le forum « Testimonials » (updates de fin de mois : un post par résultat).
      salonResultats: lire('DISCORD_SALON_RESULTATS_ID', '1573859057654046781'),
      forumTestimonials: lire('DISCORD_FORUM_TESTIMONIALS_ID', '1573301763753123970'),
      // Salon d'attente existant (identifiant). Vide : Bob crée #en-attente tout seul au démarrage.
      salonAttente: lire('DISCORD_SALON_ATTENTE_ID', ''),
    },

    tally: { secret: lire('TALLY_SIGNING_SECRET', '') },
    videoMaxMo: Number(lire('VIDEO_MAX_MO', '20')),
    videoParcoursMo: Number(lire('VIDEO_PARCOURS_MO', '150')), // vidéos des étapes 1 et 3 de l'accompagnement

    coaching: {
      // Heures GMT des créneaux de 30 minutes.
      creneaux: lire('COACHING_CRENEAUX', '15:00,15:30,16:00,16:30,17:00,17:30,21:00,21:30,22:00,22:30').split(',').map((s) => s.trim()),
      minParSemaine: Number(lire('COACHING_MIN_PAR_SEMAINE', '3')),
      maxParSemaine: Number(lire('COACHING_MAX_PAR_SEMAINE', '5')),
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
    ['DISCORD_ROLE_SINISTRE', config.discord.roleSinistre], ['DISCORD_SALON_SINISTRES_ID', config.discord.salonSinistres],
    ...Object.entries(config.discord.rolesRevenus).map(([k, v]) => [`DISCORD_ROLE_${k}`, v]),
  ]) {
    if (v && !ID_DISCORD.test(v)) manquantes.push(`${nom} (identifiant Discord : uniquement des chiffres)`);
  }
  if (config.email.cleResend && !config.email.expediteur) manquantes.push('EMAIL_EXPEDITEUR (requis avec RESEND_API_KEY)');

  if (manquantes.length) throw new Error('Configuration incomplète :\n - ' + manquantes.join('\n - '));
  return config;
}

module.exports = { chargerConfig };
