'use strict';

// Les deux offres, telles qu'elles sont présentées : le message de Bob (serveur gratuit) et les pages de présentation.
const OBJECTIF = 'Génère 1 500 € par mois avec TikTok en 45 jours.';
const OFFRES = {
  community: {
    titre: 'Communauté privée',
    nomProduit: 'Overmaxx Community',
    emoji: '🔒',
    phrase: 'Tout ce qu\'il faut pour lancer ton compte et générer tes premiers revenus.',
    avantages: [
      ['🎓', 'Notre formation privée', 'réservée aux membres'],
      ['🔥', 'Les meilleures niches du moment', 'pour générer des revenus'],
      ['📈', 'Les meilleures méthodes', 'pour atteindre 10 000 abonnés facilement'],
      ['🚀', 'Les méthodes de viralisation', 'de contenu'],
      ['🛡️', 'Nos tips', 'pour éviter les problèmes de compte et retirer tes revenus'],
    ],
    page: '/rejoindre/community',
    suite: '/community', // après la vidéo : connexion Discord puis paiement
  },
  elite: {
    titre: 'Accompagnement one-on-one',
    nomProduit: 'Overmaxx Elite',
    emoji: '👑',
    phrase: 'Fais-toi guider étape par étape pour atteindre la monétisation en moins de 2 semaines et générer 2 000 € par mois.',
    avantages: [
      ['✅', 'Tous les avantages', 'de la communauté privée'],
      ['📞', '3 à 5 lives individuels', 'selon ton programme'],
      ['👥', 'Un live de groupe par semaine', 'pour répondre aux questions de tous'],
      ['💎', 'La plateforme Overmaxx Elite', 'complète'],
      ['🔑', 'Les ressources secrètes', 'en exclusivité, avant tout le monde'],
    ],
    page: '/rejoindre/elite',
    suite: '/coaching/elite', // après la vidéo : connexion Discord puis candidature
  },
};
const COULEUR_ELITE = 0x4f46ff; // le bleu Overmaxx Elite

module.exports = { OBJECTIF, OFFRES, COULEUR_ELITE };
