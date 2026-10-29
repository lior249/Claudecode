// Les types de lives, et leurs textes de présentation par public (voir EVENEMENTS.md).

export const AUDIENCES = { free: 'Free', plug: 'Accompagnement' };

// Rôles qu'on peut mentionner dans les annonces (la clé renvoie au rôle des réglages).
export const MENTIONS = { everyone: '@everyone', free: 'Free', plug: 'TikTok (accompagnement)' };

// Rappels possibles, avec leur avance sur le début du live.
export const REMINDERS = {
  creation: { label: 'À la création (annonce)', offset: null },
  '7d': { label: '7 jours avant', offset: 7 * 24 * 60 * 60 * 1000 },
  '3d': { label: '3 jours avant', offset: 3 * 24 * 60 * 60 * 1000 },
  '24h': { label: '24 heures avant', offset: 24 * 60 * 60 * 1000 },
  '3h': { label: '3 heures avant', offset: 3 * 60 * 60 * 1000 },
};

export const LIVE_TYPES = [
  {
    key: 'decouverte',
    emoji: '🔍',
    label: 'Live découverte',
    texts: {
      free: [
        "Tu veux savoir comment des gens comme toi font de l'argent sur TikTok avec juste leur téléphone ? Ce live t'ouvre les coulisses : ce qui marche vraiment, sans blabla.",
        "Nouveau sur Unplug, ou encore en train d'hésiter ? En un live, tu vas comprendre toute la méthode et repartir avec un plan clair pour tes prochaines vidéos.",
        "On lève le voile sur une stratégie que peu de gens connaissent. Viens la découvrir, poser tes questions et voir si c'est fait pour toi.",
      ],
      plug: [
        "Nouvelle stratégie à découvrir, en exclusivité pour l'accompagnement. On la décortique ensemble, et tu l'appliques dès demain.",
        "On t'emmène plus loin : un nouveau levier pour accélérer tes résultats, présenté étape par étape.",
        'Une nouveauté réservée aux membres, à découvrir en avant-première, avant tout le monde.',
      ],
    },
  },
  {
    key: 'coaching',
    emoji: '🎯',
    label: 'Coaching gratuit',
    texts: {
      free: [
        'Coaching gratuit en direct : tu viens avec ton blocage, on le règle ensemble.\n' +
          '**Qui peut participer ?** Les membres Free qui ne sont pas en prison.\n' +
          "**Comment s'inscrire ?** Clique sur « Intéressé » sur l'événement.\n" +
          '**À préparer :** le lien de ton compte TikTok et ta question principale.',
      ],
    },
  },
  {
    key: 'awards',
    emoji: '🏆',
    label: 'Unplug Awards',
    texts: {
      free: [
        "C'est l'heure de récompenser ceux qui n'ont rien lâché ! Les gagnants du top 7, du top 30 et des 21 jours d'affilée sont célébrés en direct. Viens applaudir… et prendre des idées pour être sur scène la prochaine fois.",
      ],
      plug: [
        "Les Unplug Awards de l'accompagnement : on célèbre vos résultats, vos progrès et vos meilleures vidéos. C'est peut-être ton nom qu'on va appeler.",
      ],
    },
  },
  {
    key: 'questions',
    emoji: '❓',
    label: 'Questions-réponses',
    texts: {
      free: ['Une question te bloque ? Viens la poser en direct, on y répond sans détour.'],
      plug: ["Questions-réponses réservées à l'accompagnement : ramène tes blocages, on les débloque ensemble."],
    },
  },
  {
    key: 'analyse',
    emoji: '🔬',
    label: 'Analyse de comptes',
    texts: {
      free: [
        'On analyse des comptes TikTok de membres en direct : ce qui marche, ce qui bloque, quoi changer. Tu apprendras autant en regardant les autres.',
      ],
      plug: ["Hot seat : on passe vos comptes au crible, en direct. Prépare ton compte, c'est peut-être ton tour."],
    },
  },
  {
    key: 'masterclass',
    emoji: '🎓',
    label: 'Masterclass',
    texts: {
      free: ['Une masterclass, un sujet, zéro remplissage. Tu repars avec des actions concrètes à appliquer tout de suite.'],
      plug: ['Masterclass exclusive : on va au fond du sujet, avec des exemples et la méthode complète.'],
    },
  },
  {
    key: 'tendances',
    emoji: '📈',
    label: 'Tendances de la semaine',
    texts: {
      free: ['Les sons, formats et sujets qui explosent cette semaine sur TikTok. Viens avec ton téléphone : tu pourras filmer juste après.'],
      plug: ["Veille tendances de l'accompagnement : on choisit ensemble les formats à tourner cette semaine."],
    },
  },
  {
    key: 'coworking',
    emoji: '💻',
    label: 'Co-working',
    texts: {
      free: ['On poste ensemble ! Une session pour créer et publier ta vidéo en direct avec les autres membres. Zéro excuse, show-up garanti.'],
      plug: ["Co-working de l'accompagnement : on tourne, on monte et on publie ensemble, avec de l'aide en direct."],
    },
  },
  {
    key: 'temoignage',
    emoji: '🎤',
    label: 'Témoignage ou invité',
    texts: {
      free: ['Un membre qui était à ta place il y a quelques mois vient raconter son parcours, sans filtre.'],
      plug: ["Invité spécial pour l'accompagnement : son parcours, ses chiffres, ses erreurs. Viens avec tes questions."],
    },
  },
  {
    key: 'bilan',
    emoji: '📊',
    label: 'Bilan',
    texts: {
      free: ['Le bilan : les meilleurs, les progrès, les erreurs à éviter et les objectifs pour la suite.'],
      plug: ["Le bilan de l'accompagnement : vos résultats, vos chiffres et le plan d'action pour la suite."],
    },
  },
  {
    key: 'accueil',
    emoji: '👋',
    label: 'Accueil des nouveaux',
    texts: {
      free: [
        "Tu viens d'arriver sur Unplug ? Ce live t'explique tout : comment marche le serveur, les classements, la prison, et par où commencer dès ce soir.",
      ],
      plug: ["Bienvenue dans l'accompagnement ! On fait le tour de tout ce qui t'attend et de tes premières étapes."],
    },
  },
  {
    key: 'battle',
    emoji: '⚔️',
    label: 'Battle ou défi',
    texts: {
      free: ['Défi en direct ! Le meilleur repart avec la gloire, et peut-être plus. Prêt à relever le défi ?'],
      plug: ["Battle de l'accompagnement : montre ce que tu sais faire devant tout le groupe."],
    },
  },
  {
    key: 'annonce',
    emoji: '📣',
    label: 'Annonce et nouveautés',
    texts: {
      free: ['Grosse annonce sur Unplug : des nouveautés arrivent, et tu veux être le premier au courant.'],
      plug: ["Annonce importante pour l'accompagnement : les nouveautés, les changements et ce que ça change pour toi."],
    },
  },
  {
    key: 'live',
    emoji: '🔴',
    label: 'Live accompagnement',
    texts: {
      plug: ["Live de l'accompagnement : on avance ensemble sur tes vidéos, tes chiffres et tes questions."],
    },
  },
];

export function liveType(key) {
  return LIVE_TYPES.find((type) => type.key === key) ?? null;
}

// Publics possibles pour un type de live.
export function audiencesOf(type) {
  return Object.keys(type.texts);
}
