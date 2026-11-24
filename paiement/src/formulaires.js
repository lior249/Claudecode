'use strict';

// ============================================================================
//  Les questions des formulaires de candidature Elite.
//  Pour ajouter une question : copie un bloc { ... } et change son id (unique) et son texte.
//
//  Types possibles :
//    texte        réponse courte            (option : max = nombre de caractères)
//    texte_long   réponse longue (plusieurs lignes)
//    email        adresse email
//    nombre       un nombre                 (options : min, max)
//    choix        une option parmi plusieurs (option : options = ['A', 'B', …])
//    discord      pseudo Discord : vérifié sur le serveur (indispensable au formulaire 1)
//    video        envoi d'une vidéo         (taille max : VIDEO_MAX_MO, 20 Mo par défaut)
//
//  Option pour toutes les questions : images = [{ src, legende }] (tutoriel affiché sous la question),
//  avec lienImages = texte du lien qui l'ouvre. Les images vont dans paiement/public/aide/.
// ============================================================================

const FORMULAIRES = {
  // Formulaire 1 : candidature (page /coaching/elite). Réponse sous 24 h par Bob.
  candidature: {
    titre: 'Candidature Overmaxx Elite',
    questions: [
      {
        id: 'nom', type: 'texte', max: 100, obligatoire: true,
        question: 'Quel est ton nom ?',
        aide: 'Ton prénom et ton nom.',
      },
      {
        id: 'discord', type: 'discord', obligatoire: true,
        question: 'Quel est ton pseudo Discord ?',
        aide: 'Le petit nom écrit sous ton nom dans ton profil Discord (par exemple awa_27). C\'est là que Bob, notre bot, te répondra.',
        // Tutoriel en images (fichiers dans paiement/public/aide/), affiché avec « Où trouver mon pseudo ? ».
        images: [
          { src: '/static/aide/pseudo-1.jpg', legende: '1. Ouvre l\'application Discord.' },
          { src: '/static/aide/pseudo-2.jpg', legende: '2. Appuie sur ta photo de profil.' },
          { src: '/static/aide/pseudo-3.jpg', legende: '3. Ton pseudo est le petit nom sous ton nom (ici : nofloh24). Écris exactement celui-là.' },
        ],
        lienImages: 'Où trouver mon pseudo ?',
      },
    ],
  },

  // Formulaire 2 : confirmation, réservé aux profils retenus (lien envoyé par Bob).
  confirmation: {
    titre: 'Confirmation de ta candidature',
    questions: [
      {
        id: 'video', type: 'video', obligatoire: true,
        question: 'Envoie une vidéo de toi',
        aide: 'Filme-toi en train de te présenter. La vidéo doit être légère.',
      },
    ],
  },
};

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Vérifie les réponses (hors vidéo) d'un formulaire. Renvoie { reponses: [{ id, label, valeur }] } ou { champ, erreur }.
function verifierReponses(nom, brutes, { sauter = [] } = {}) {
  const f = FORMULAIRES[nom];
  const reponses = [];
  for (const q of f.questions) {
    if (q.type === 'video' || sauter.includes(q.id)) continue;
    let v = brutes && brutes[q.id] !== undefined && brutes[q.id] !== null ? String(brutes[q.id]).trim() : '';
    if (!v) {
      if (q.obligatoire) return { champ: q.id, erreur: 'Cette question est obligatoire.' };
      continue;
    }
    if (q.type === 'texte' || q.type === 'discord') v = v.slice(0, q.max || 200);
    if (q.type === 'texte_long') v = v.slice(0, q.max || 2000);
    if (q.type === 'email' && !EMAIL.test(v)) return { champ: q.id, erreur: 'Cet email n\'est pas valide.' };
    if (q.type === 'nombre') {
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n) || (q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max)) return { champ: q.id, erreur: 'Entre un nombre valide.' };
    }
    if (q.type === 'choix' && !(q.options || []).includes(v)) return { champ: q.id, erreur: 'Choisis une des options.' };
    reponses.push({ id: q.id, label: q.question, valeur: v });
  }
  return { reponses };
}

module.exports = { FORMULAIRES, verifierReponses };
