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

const practice = (title: string, summary: string, config: Record<string, unknown>): LessonSeed => ({
  title,
  type: "PRACTICE_AI",
  summary,
  config: { threshold: 8, placeholder: true, ...config },
});

// Textes d'exemple (à remplacer par les vrais scripts dans l'Admin).
const EXAMPLE_SCRIPT =
  "Il est impossible pour un pilote de survivre à un barrel roll sans entraînement. " +
  "Pourtant, certains pilotes de chasse en enchaînent plusieurs par vol. " +
  "Leur secret tient en trois choses : la respiration, la combinaison anti-g et des années de pratique. " +
  "Sans elles, le sang quitte le cerveau et le pilote perd connaissance en quelques secondes.";
const EXAMPLE_HOOK = "Il est impossible pour un pilote de survivre à un barrel roll sans entraînement.";

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
          practice(
            "Les cuts",
            "Monte la vidéo fournie en plaçant tes cuts exactement aux bons moments. Exporte-la sans le son.",
            { accept: ["video"], checks: [{ type: "noAudio" }, { type: "cuts", expected: [3, 5, 8, 13], tolerance: 0.5, penaltyPerMiss: 2 }] },
          ),
          practice(
            "La voix off",
            "Coupe tous les silences de la voix off fournie. Aucun temps mort.",
            { accept: ["audio"], checks: [{ type: "silences", minSilence: 0.5, penaltyPerSilence: 1 }] },
          ),
          practice(
            "Les illustrations en rythme",
            "Ajoute une illustration par bout de phrase, en rythme avec la voix off. Vidéo de 30 secondes.",
            {
              accept: ["video"],
              checks: [
                { type: "duration", target: 30, tolerance: 1, penalty: 2 },
                { type: "maxShotLength", max: 3, penaltyPerShot: 1, maxPenalty: 3 },
                { type: "silences", minSilence: 0.5, penaltyPerSilence: 1, maxPenalty: 3 },
              ],
              rubric:
                "Script de référence, une ligne = une illustration :\nIl est impossible pour un pilote\nde survivre à un barrel roll\nsans entraînement.\n\n" +
                "1. Chaque illustration change sur un bout de phrase (pas une illustration par phrase entière) — 3 points, −1 par changement mal placé.\n" +
                "2. Un effet sonore accompagne chaque transition — 2 points, −1 par transition sans effet sonore.",
            },
          ),
        ],
      },
      {
        title: "Scripting",
        description: "Transcrire, réduire, ajouter un CTA.",
        lessons: [
          practice(
            "La transcription",
            "Écoute la voix off fournie sur Whop et écris son script, mot pour mot.",
            { accept: ["text"], checks: [{ type: "textSimilarity", reference: EXAMPLE_SCRIPT, min: 0.96 }] },
          ),
          practice(
            "Réduire un script",
            "Raccourcis le script fourni sans toucher au hook (la première phrase).",
            {
              accept: ["text"],
              checks: [{ type: "hookUnchanged", hook: EXAMPLE_HOOK, penalty: 5 }, { type: "shorterThan", reference: EXAMPLE_SCRIPT, penalty: 3 }],
              rubric: `Script d'origine :\n${EXAMPLE_SCRIPT}\n\n1. Aucune information importante n'est perdue (3 points, −1 par idée clé supprimée).`,
            },
          ),
          practice(
            "Ajouter un CTA",
            "Place un CTA naturel dans le script fourni.",
            {
              accept: ["text"],
              rubric:
                `Script d'origine :\n${EXAMPLE_SCRIPT}\n\nEmplacements possibles du CTA : après la 2e phrase, ou à la fin.\n\n` +
                "1. Un CTA est présent (4 points).\n2. Il est placé à un des emplacements possibles (3 points).\n3. Il s'enchaîne naturellement avec la phrase d'avant (3 points).",
            },
          ),
        ],
      },
      {
        title: "Test",
        description: "Ta première vidéo complète.",
        lessons: [
          practice(
            "La vidéo complète",
            "Réalise une vidéo complète à partir du script fourni : script, voix off, montage.",
            {
              accept: ["video", "text"],
              checks: [{ type: "silences", minSilence: 0.5, penaltyPerSilence: 1, maxPenalty: 3 }, { type: "hookUnchanged", hook: EXAMPLE_HOOK, penalty: 3 }],
              rubric:
                "Le texte envoyé est le script utilisé dans la vidéo.\n" +
                "1. Le script est réduit sans perte d'idée clé (2 points).\n2. Le CTA est placé naturellement (2 points).\n" +
                "3. Illustrations rythmées sur les bouts de phrase, 3 s maximum (2 points).\n4. Effets sonores sur les transitions (1 point).",
            },
          ),
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
  await prisma.quizAnswer.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
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
    data: { displayName: "Coach Creato", role: "ADMIN", coachOrder: 1, coachCapacity: 20 },
  });
  await prisma.user.create({ data: { displayName: "Élève démo", role: "LEARNER", coachId: coach.id } });

  console.log("Parcours de départ créé (3 niveaux, 8 modules, 12 leçons) + comptes de démonstration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
