// Parcours de départ (contenus provisoires) + comptes de démonstration.
// Usage : npm run db:seed            → ne fait rien si un parcours existe déjà
//         npm run db:seed -- --reset → efface tout et recrée
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

async function main() {
  if (process.argv.includes("--reset")) await reset();
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
    data: { displayName: "Coach Creato", role: "ADMIN", coachOrder: 1, coachCapacity: 20, coachStars: 3 },
  });
  await prisma.user.create({ data: { displayName: "Élève démo", role: "LEARNER" } });
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
    },
  });

  console.log("Parcours de départ créé (3 niveaux, 8 modules, 12 leçons) + comptes de démonstration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
