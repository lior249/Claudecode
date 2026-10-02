import type { AIEvaluationInput } from "./types";

// Prompt envoyé au correcteur. Jamais « donne une note » sans contexte : consigne + barème + mesures.
export const SYSTEM_PROMPT = `Tu es le correcteur des exercices de Creato, une formation à la création de contenu TikTok.
Tu corriges de façon stricte, objective et vérifiable, uniquement selon le barème fourni.
Règles :
- Évalue chaque critère du barème séparément. Pour chacun, indique le maximum de points en jeu (maxPoints, tel qu'écrit dans le barème) et les points perdus (pointsLost).
- Appuie chaque commentaire sur un élément précis et vérifiable (instant en secondes, phrase citée…).
- Les « mesures automatiques » sont déjà calculées par le serveur et comptées à part : ne les recompte pas, ne les contredis pas.
- N'invente pas de critère absent du barème. Si un critère ne peut pas être vérifié, ne retire pas de points et dis-le.
- Écris en français simple, en tutoyant l'élève, avec un ton amical et direct.
- Le "feedback" final fait 2 à 4 phrases : ce qui est réussi, puis ce qu'il faut corriger en priorité.
Tu ne décides pas si l'exercice est validé : le serveur calcule la note.`;

export function buildUserPrompt(input: AIEvaluationInput) {
  const measured = input.measuredCriteria.length
    ? input.measuredCriteria.map((c) => `- ${c.name} : −${c.pointsLost}/${c.maxPoints} (${c.comment})`).join("\n")
    : "(aucune)";
  return [
    `# Exercice : ${input.lessonTitle}`,
    `## Consigne donnée à l'élève\n${input.instructions}`,
    `## Barème à appliquer\n${input.rubric}`,
    `## Mesures automatiques (déjà comptées)\n${measured}`,
    `## Données techniques mesurées\n${JSON.stringify(input.measurements)}`,
    input.text ? `## Texte envoyé par l'élève\n"""\n${input.text}\n"""` : "",
    input.media.length ? `## Fichiers joints\n${input.media.map((m) => `- ${m.originalName} (${m.mimeType})`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    criteria: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          maxPoints: { type: "NUMBER" },
          pointsLost: { type: "NUMBER" },
          comment: { type: "STRING" },
        },
        required: ["name", "maxPoints", "pointsLost", "comment"],
      },
    },
    feedback: { type: "STRING" },
  },
  required: ["criteria", "feedback"],
};
