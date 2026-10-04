// Données de départ : critères des catalogues et types de résultats (une seule fois, modifiables ensuite dans l'Admin).
// En développement seulement : un parcours de démonstration et des comptes de test.
// Usage : npm run db:seed                 → démonstration (ne fait rien si un parcours existe déjà)
//         npm run db:seed -- --reset      → efface tout et recrée (refusé en production)
//         npm run db:seed -- --production → données de départ seulement : la base démarre vide, l'admin crée tout
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { LessonType } from "../src/generated/prisma/enums";
import { generateValidationCode } from "../src/lib/codes";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

type LessonSeed = { title: string; type: LessonType; summary: string; config?: Record<string, unknown> };
type ModuleSeed = { title: string; description: string; lessons: LessonSeed[] };
type LevelSeed = { title: string; description: string; modules: ModuleSeed[] };

// Exercices de pratique : aucun critère prédéfini, l'Admin les écrit lui-même (Admin → exercice).
const practice = (title: string, summary: string, accept: string[]): LessonSeed => ({
  title,
  type: "PRACTICE_AI",
  summary,
  config: { threshold: 8, accept, agentInstructions: "", criteria: [], referenceText: "", referenceAssetId: null },
});

const curriculum: LevelSeed[] = [
  {
    title: "Les bases",
    description: "Maîtrise le montage et le script avant tout.",
    modules: [
      {
        title: "Monétisation",
        description: "Comprendre comment on gagne de l'argent sur TikTok.",
        lessons: [
          {
            title: "Comprendre la monétisation",
            type: "UNDERSTANDING",
            summary: "Regarde le module sur Whop, puis réponds aux 20 questions. Il te faut 16/20 pour valider.",
            config: { passScore: 16, cooldownMinutes: 5 },
          },
        ],
      },
      {
        title: "Montage",
        description: "Cuts, voix off et illustrations en rythme.",
        lessons: [
          practice("Les cuts", "Monte la vidéo fournie en plaçant tes cuts exactement aux bons moments. Exporte-la sans le son.", ["video"]),
          practice("La voix off", "Coupe tous les silences de la voix off fournie. Aucun temps mort.", ["audio"]),
          practice("Les illustrations en rythme", "Ajoute une illustration par bout de phrase, en rythme avec la voix off. Vidéo de 30 secondes.", ["video"]),
        ],
      },
      {
        title: "Scripting",
        description: "Transcrire, réduire, ajouter un CTA.",
        lessons: [
          practice("La transcription", "Écoute la voix off fournie sur Whop et écris son script, mot pour mot.", ["text"]),
          practice("Réduire un script", "Raccourcis le script fourni sans toucher au hook (la première phrase).", ["text"]),
          practice("Ajouter un CTA", "Place un CTA naturel dans le script fourni.", ["text"]),
        ],
      },
      {
        title: "Test",
        description: "Ta première vidéo complète.",
        lessons: [
          practice("La vidéo complète", "Réalise une vidéo complète à partir du script fourni : script, voix off, montage.", ["video", "text"]),
        ],
      },
    ],
  },
  {
    title: "Positionnement",
    description: "Fais tes choix avant de lancer ton compte.",
    modules: [
      {
        title: "Choix de niche",
        description: "Choisis la niche avec laquelle tu vas travailler.",
        lessons: [{ title: "Choisis ta niche", type: "DECISION", summary: "Parcours les fiches et choisis UNE niche.", config: { catalog: "niches" } }],
      },
      {
        title: "Pays cible",
        description: "Choisis le pays que tu vas viser.",
        lessons: [{ title: "Choisis ton pays", type: "DECISION", summary: "Compare les pays de la monétisation et choisis-en UN.", config: { catalog: "countries" } }],
      },
      {
        title: "Méthode 10K",
        description: "Choisis ta méthode pour atteindre 10 000 abonnés.",
        lessons: [{ title: "Choisis ta méthode", type: "DECISION", summary: "Choisis UNE méthode pour atteindre les 10K.", config: { catalog: "methods10k" } }],
      },
    ],
  },
  {
    title: "Lancement",
    description: "Tes 5 premières vidéos, puis le coaching.",
    modules: [
      {
        title: "Lancement",
        description: "Réalise tes 5 vidéos et passe en coaching.",
        lessons: [
          {
            title: "Valide ton lancement",
            type: "CODE_VALIDATION",
            summary: "Termine le module sur Whop. Tu y trouveras la phrase et le code à saisir ici.",
            config: { phrase: "J'ai validé le module à 100 %", code: generateValidationCode() },
          },
        ],
      },
    ],
  },
];

// 20 questions d'exemple pour le QCM Monétisation (à remplacer dans l'Admin).
async function seedPlaceholderQuiz(lessonId: string) {
  for (let position = 1; position <= 20; position++) {
    await prisma.quizQuestion.create({
      data: {
        lessonId,
        position,
        question: `Question d'exemple n° ${position} : laquelle est la bonne réponse ?`,
        answerA: "La bonne réponse",
        answerB: "Une mauvaise réponse",
        answerC: "Une autre mauvaise réponse",
        answerD: "Encore une mauvaise réponse",
        correctAnswer: "A",
        explanation: "Exemple d'explication : remplace cette question dans l'Admin.",
      },
    });
  }
}

async function reset() {
  // Vide toutes les tables de l'application (pas l'historique des migrations).
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

// Critères de départ des catalogues (modifiables ensuite dans l'admin), mêmes identifiants que la migration catalog_criteria.
async function seedCatalogCriteria() {
  if ((await prisma.catalogCriterion.count()) > 0) return;
  const defaults = [
    { key: "comp", label: "Concurrence", options: [["LOW", "Faible", "green"], ["MEDIUM", "Moyenne", "yellow"], ["HIGH", "Forte", "red"]] },
    { key: "equip", label: "Matériel", options: [["PHONE", "Téléphone", "gray"], ["PC", "PC", "gray"], ["BOTH", "PC et téléphone", "gray"]] },
  ];
  for (const catalog of ["NICHE", "COUNTRY", "METHOD_10K"] as const) {
    for (const [ci, c] of defaults.entries()) {
      const criterion = await prisma.catalogCriterion.create({ data: { id: `crit_${c.key}_${catalog}`, catalog, label: c.label, position: ci + 1 } });
      for (const [oi, [k, label, color]] of c.options.entries()) {
        await prisma.catalogOption.create({ data: { id: `opt_${c.key}_${k}_${catalog}`, criterionId: criterion.id, label, color, position: oi + 1 } });
      }
    }
  }
}

// Types de résultats de départ (mêmes identifiants que la migration result_types).
async function seedResultTypes() {
  if ((await prisma.resultType.count()) > 0) return;
  await prisma.resultType.createMany({
    data: [
      {
        id: "rt_video",
        name: "Résultat d'une vidéo",
        instructions:
          "Capture de l'écran « Video analysis » de TikTok Studio (onglet Overview), recadrée : on voit la date de publication, les compteurs et les « Key metrics ». Coupe le haut de l'écran pour cacher la vidéo (ta niche reste secrète). Écris ton code du jour sur la capture.",
        exampleKey: "exemples/resultat-video.jpg",
        aiMustHave: "L'écran « Video analysis » de TikTok Studio : la date « Posted on … », les compteurs (vues, j'aime, commentaires, partages, enregistrements) et le bloc « Key metrics » avec « Video views ».",
        aiMustNotHave: "L'image de la vidéo elle-même, la miniature, le nom du compte, la description de la vidéo ou tout élément qui dévoile la niche.",
        aiIdentifier: "La date et l'heure de publication (« Posted on … »).",
        points: 0,
        metric: "VIEWS",
        tiers: [{ min: 10000, points: 1 }, { min: 100000, points: 2 }, { min: 300000, points: 3 }, { min: 500000, points: 4 }, { min: 1000000, points: 5 }],
        position: 1,
      },
      {
        id: "rt_monthly",
        name: "Revenus du mois",
        instructions: "À envoyer le dernier jour du mois : capture de ton tableau de bord de revenus du mois (montant total visible en euros). Écris ton code du jour sur la capture.",
        aiMustHave: "Un tableau de bord de revenus (programme de monétisation) avec le montant total du mois.",
        aiMustNotHave: "Le nom du compte, la photo de profil ou tout élément qui dévoile la niche.",
        points: 2,
        metric: "REVENUE_EUR",
        tiers: [{ min: 0, points: 2 }, { min: 100, points: 3 }, { min: 500, points: 5 }, { min: 1000, points: 8 }],
        special: "MONTHLY_REVENUE",
        position: 2,
      },
      {
        id: "rt_followers",
        name: "10 000 abonnés",
        instructions: "Capture de ton profil TikTok où l'on voit le nombre d'abonnés (10 000 ou plus). Écris ton code du jour sur la capture.",
        aiMustHave: "Le nombre d'abonnés (« Followers » / « Abonnés ») du compte, 10 000 ou plus.",
        aiMustNotHave: "Les vidéos du compte (miniatures) qui dévoilent la niche.",
        points: 3,
        metric: "FOLLOWERS",
        special: "FOLLOWERS_RANK",
        position: 3,
      },
    ],
  });
}

async function main() {
  const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
  if (process.argv.includes("--reset")) {
    if (production) throw new Error("--reset est interdit en production (il effacerait les élèves).");
    await reset();
  }
  // Seulement à la première installation (ou après une remise à zéro) : ce que l'admin supprime ne revient pas.
  if (!(await prisma.appSetting.findUnique({ where: { key: "initialized" } }))) {
    await seedCatalogCriteria();
    await seedResultTypes();
    await prisma.appSetting.create({ data: { key: "initialized", value: true } });
    console.log("Données de départ créées (critères des catalogues, types de résultats).");
  }
  // En production, la base démarre vide : l'admin crée les niveaux, modules, leçons et liens Whop un par un.
  if (production) return;
  if ((await prisma.level.count()) > 0) {
    console.log("Un parcours existe déjà : rien à faire (utilise --reset pour repartir de zéro).");
    return;
  }

  for (const [li, level] of curriculum.entries()) {
    const levelRow = await prisma.level.create({
      data: { title: level.title, description: level.description, position: li + 1 },
    });
    for (const [mi, mod] of level.modules.entries()) {
      const moduleRow = await prisma.module.create({
        data: {
          levelId: levelRow.id,
          title: mod.title,
          description: mod.description,
          position: mi + 1,
          whopUrl: "https://whop.com/", // à remplacer par le lien secret du module
        },
      });
      for (const [i, lesson] of mod.lessons.entries()) {
        const lessonRow = await prisma.lesson.create({
          data: {
            moduleId: moduleRow.id,
            title: lesson.title,
            summary: lesson.summary,
            type: lesson.type,
            position: i + 1,
            config: (lesson.config ?? {}) as object,
          },
        });
        if (lesson.type === "UNDERSTANDING") await seedPlaceholderQuiz(lessonRow.id);
      }
    }
  }

  const coach = await prisma.user.create({
    data: { displayName: "Coach Creato", role: "ADMIN", coachOrder: 1, coachCapacity: 20, coachStars: 3, onboardedAt: new Date() },
  });
  await prisma.user.create({ data: { displayName: "Élève démo", role: "LEARNER", onboardedAt: new Date() } });
  // Élève déjà en coaching (démo) : Learn terminé, suivi par le coach n° 1.
  const now = new Date();
  await prisma.user.create({
    data: {
      displayName: "Inès (démo coaching)",
      role: "LEARNER",
      coachId: coach.id,
      coachingStatus: "ACTIVE",
      coachingStartedAt: new Date(now.getTime() - 10 * 86_400_000),
      learnStartedAt: new Date(now.getTime() - 20 * 86_400_000),
      learnCompletedAt: new Date(now.getTime() - 10 * 86_400_000),
      tiktokUsername: "ines.demo",
      timezone: "Europe/Paris",
      onboardedAt: now,
    },
  });

  console.log("Parcours de démonstration créé (3 niveaux, 8 modules, 12 leçons) + comptes de démonstration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
