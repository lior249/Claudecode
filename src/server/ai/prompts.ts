import type { AnalyzeInput, GradeInput } from "./types";

// ---------- Analyste ----------

export const ANALYST_SYSTEM = `Tu es l'analyste vidéo et audio de Creato, une formation à la création de contenu TikTok.
Ton rôle : décrire OBJECTIVEMENT et PRÉCISÉMENT la réalisation d'un élève. Tu ne notes pas, tu ne juges pas.
Règles :
- Donne des instants en secondes (avec décimales) pour tout ce que tu décris.
- Transcris la voix mot pour mot, découpée en segments avec leurs instants de début et de fin.
- Décris chaque plan (ce qu'on voit, changement d'illustration), les textes à l'écran, et chaque événement sonore
  (effet sonore, musique, coupure, silence notable), avec son instant.
- Des mesures exactes faites par ffmpeg te sont données (cuts, silences, durée) : appuie-toi dessus pour les instants,
  elles sont plus précises que ta perception.
- Si une vidéo de référence est fournie, décris en quoi la réalisation s'en rapproche ou s'en écarte.
- Les critères de l'exercice te sont donnés pour savoir quoi observer avec attention, mais tu ne dis pas s'ils sont respectés.
- Écris en français.`;

export function analystPrompt(input: AnalyzeInput) {
  return [
    `# Exercice : ${input.lessonTitle}`,
    `## Ce que l'exercice demande (pour savoir quoi observer)\n${input.agentInstructions}`,
    `## Points d'attention\n${input.criteria.map((c, i) => `${i + 1}. ${c.instruction}`).join("\n")}`,
    `## Mesures exactes (ffmpeg)\n${JSON.stringify(input.measurements)}`,
    input.reference
      ? "Le premier fichier est la RÉALISATION DE L'ÉLÈVE. Le second est la RÉFÉRENCE (exemple attendu)."
      : "Le fichier joint est la RÉALISATION DE L'ÉLÈVE.",
  ].join("\n\n");
}

export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    transcript: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { start: { type: "NUMBER" }, end: { type: "NUMBER" }, text: { type: "STRING" } }, required: ["start", "end", "text"] },
    },
    shots: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { start: { type: "NUMBER" }, end: { type: "NUMBER" }, description: { type: "STRING" } }, required: ["start", "end", "description"] },
    },
    soundEvents: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { time: { type: "NUMBER" }, description: { type: "STRING" } }, required: ["time", "description"] },
    },
    onScreenText: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { time: { type: "NUMBER" }, text: { type: "STRING" } }, required: ["time", "text"] },
    },
    comparisonWithReference: { type: "STRING" },
  },
  required: ["summary", "transcript", "shots", "soundEvents", "onScreenText", "comparisonWithReference"],
};

// ---------- Correcteur ----------

export const GRADER_SYSTEM = `Tu es le correcteur de Creato, une formation à la création de contenu TikTok.
Tu reçois la consigne de l'exercice écrite par le formateur, la liste des critères, et un rapport d'analyse
(mesures exactes + description détaillée de la réalisation). Tu ne regardes pas la vidéo toi-même : tu t'appuies sur le rapport.
Pour CHAQUE critère :
- compte le nombre de fois où il n'est PAS respecté sur toute la durée de la réalisation ("misses", nombre entier, 0 si respecté) ;
- liste chaque erreur dans "evidence" avec son instant en secondes (ou null pour un texte) et ce qui ne va pas, précisément ;
- écris un commentaire court pour l'élève (tutoiement, ton amical et direct, français simple).
Règles :
- Les mesures exactes (instants des cuts, durées des silences, pourcentage de ressemblance du texte) font foi :
  utilise-les telles quelles, ne les recalcule pas, ne les arrondis pas en faveur de l'élève.
- Applique la consigne du formateur à la lettre (seuils, tolérances, exemples). En cas de doute réel, ne compte pas d'erreur
  et explique pourquoi dans le commentaire.
- N'invente pas de critère. Tu ne calcules ni points ni note : le serveur s'en charge.
- "feedback" : 2 à 4 phrases pour l'élève — ce qui est réussi, puis la priorité à corriger.
Réponds avec l'identifiant exact de chaque critère.`;

export function graderPrompt(input: GradeInput) {
  return [
    `# Exercice : ${input.lessonTitle}`,
    `## Consigne donnée à l'élève\n${input.learnerInstructions}`,
    `## Consigne du formateur (pour toi)\n${input.agentInstructions}`,
    `## Critères à vérifier\n${input.criteria.map((c) => `- id "${c.id}" : ${c.instruction}`).join("\n")}`,
    input.referenceText ? `## Texte de référence\n"""\n${input.referenceText}\n"""` : "",
    input.text ? `## Texte envoyé par l'élève\n"""\n${input.text}\n"""` : "",
    `## Rapport d'analyse\n${JSON.stringify(input.report, null, 1)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const GRADING_SCHEMA = {
  type: "OBJECT",
  properties: {
    criteria: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          criterionId: { type: "STRING" },
          misses: { type: "INTEGER" },
          evidence: {
            type: "ARRAY",
            items: { type: "OBJECT", properties: { time: { type: "NUMBER", nullable: true }, detail: { type: "STRING" } }, required: ["detail"] },
          },
          comment: { type: "STRING" },
        },
        required: ["criterionId", "misses", "evidence", "comment"],
      },
    },
    feedback: { type: "STRING" },
  },
  required: ["criteria", "feedback"],
};
