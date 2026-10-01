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

const practice = (title: string, summary: string, rubric: string): LessonSeed => ({
  title,
  type: "PRACTICE_AI",
  summary,
  config: { threshold: 8, rubric, placeholder: true },
});

const curriculum: LevelSeed[] = [
  {
    title: "Les bases",
    description: "Maîtrise le montage et le script avant tout.",
    modules: [
      {
        title: "Montage",
        description: "Cuts, voix off et illustrations en rythme.",
        lessons: [
          practice(
            "Les cuts",
            "Monte la vidéo fournie en plaçant tes cuts exactement aux bons moments. Exporte-la sans le son.",
            "4 cuts attendus : à 3 s, puis +2 s, +3 s, +5 s (3 s, 5 s, 8 s, 13 s), tolérance ± 0,5 s.\n" +
              "Chaque cut manquant ou mal placé : −2 points.\nLa vidéo ne doit contenir aucune piste audio.",
          ),
          practice(
            "La voix off",
            "Coupe tous les silences de la voix off fournie. Aucun temps mort.",
            "Chaque silence de 0,5 s ou plus : −1 point. Un silence jusqu'à 0,49 s est toléré.",
          ),
          practice(
            "Les illustrations en rythme",
            "Ajoute une illustration par bout de phrase, en rythme avec la voix off. Vidéo de 30 secondes.",
            "Une illustration par bout de phrase (chaque ligne du script = un changement de scène).\n" +
              "Une illustration dure 3 s maximum.\nEffets sonores sur les transitions.\nSilences coupés.",
          ),
        ],
      },
      {
        title: "Scripting",
        description: "Transcrire, réduire, ajouter un CTA.",
        lessons: [
          practice(
            "La transcription",
            "Écoute la voix off fournie et écris son script, mot pour mot.",
            "Le texte doit correspondre au script de référence à 96 % minimum.",
          ),
          practice(
            "Réduire un script",
            "Raccourcis le script fourni sans toucher au hook (la première phrase).",
            "Le hook reste identique.\nLe script est plus court.\nAucune nuance importante n'est perdue.",
          ),
          practice(
            "Ajouter un CTA",
            "Place un CTA naturel dans le script fourni.",
            "Le CTA est placé à l'un des emplacements prévus.\nIl s'intègre naturellement au script.",
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
            "Comparaison avec la vidéo d'exemple : script réduit avec hook intact, CTA bien placé, cuts, silences, illustrations.",
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

async function reset() {
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
        await prisma.lesson.create({
          data: {
            moduleId: moduleRow.id,
            title: lesson.title,
            summary: lesson.summary,
            type: lesson.type,
            position: i + 1,
            config: (lesson.config ?? {}) as object,
          },
        });
      }
    }
  }

  const coach = await prisma.user.create({
    data: { displayName: "Coach Creato", role: "ADMIN", coachOrder: 1, coachCapacity: 20 },
  });
  await prisma.user.create({ data: { displayName: "Élève démo", role: "LEARNER", coachId: coach.id } });

  console.log("Parcours de départ créé (3 niveaux, 7 modules, 11 leçons) + comptes de démonstration.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
