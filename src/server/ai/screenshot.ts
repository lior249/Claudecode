import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AIError } from "./types";

// Lecture d'une capture de résultat : l'IA vérifie la forme et lit les chiffres. Elle ne décide jamais des points.

export interface ScreenshotInput {
  typeName: string;
  instructions: string; // consigne donnée à l'élève
  mustHave: string;
  mustNotHave: string;
  identifier: string; // ce qui identifie le résultat (vide = rien à lire)
  metricRead: string; // chiffre à lire (vide = aucun)
  dailyCode: string;
  title: string; // titre écrit par l'élève (contexte seulement)
  image: { data: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" };
}

export const screenshotVerdict = z.object({
  conforms: z.boolean(), // la capture correspond au type et ne contient rien d'interdit
  problems: z.array(z.string()), // raisons, en français, adressées au membre (vide si conforme)
  codeFound: z.boolean(), // le code du jour est écrit sur la capture
  forbiddenFound: z.boolean(), // un élément interdit est visible
  metricValue: z.number().int().nonnegative().nullable(), // chiffre lu (null si rien à lire ou illisible)
  identifier: z.string().nullable(), // identifiant lu (null si rien à lire)
  summary: z.string(), // une phrase : ce que montre la capture
});
export type ScreenshotVerdict = z.infer<typeof screenshotVerdict> & { model: string };

export interface ScreenshotReader {
  read(input: ScreenshotInput): Promise<ScreenshotVerdict>;
}

// Schéma JSON envoyé à Claude (sortie structurée) : mêmes champs que screenshotVerdict.
const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conforms", "problems", "codeFound", "forbiddenFound", "metricValue", "identifier", "summary"],
  properties: {
    conforms: { type: "boolean" },
    problems: { type: "array", items: { type: "string" } },
    codeFound: { type: "boolean" },
    forbiddenFound: { type: "boolean" },
    metricValue: { type: ["integer", "null"] },
    identifier: { type: ["string", "null"] },
    summary: { type: "string" },
  },
};

const SYSTEM = `Tu vérifies des captures d'écran de résultats envoyées par les membres d'une formation TikTok (Creato).
Pour chaque capture, on te donne le type de résultat attendu, ce qui doit s'y trouver, ce qui ne doit surtout pas s'y trouver,
le code du jour que le membre doit avoir écrit sur la capture et, éventuellement, un chiffre et un identifiant à lire.

Règles :
- "conforms" vaut true seulement si la capture correspond au type attendu, contient tout ce qui doit s'y trouver,
  ne contient rien d'interdit et porte le code du jour. Dans le doute, false.
- "codeFound" : le code du jour exact est écrit quelque part sur l'image (à la main, en texte ajouté, etc.).
- "forbiddenFound" : un élément interdit est visible, même partiellement.
- "metricValue" : le chiffre demandé, en nombre entier (634.2K = 634200, 1,103 = 1103, 1.4M = 1400000, 12,5 k€ = 12500).
  Prends la valeur la plus précise affichée. null si aucun chiffre n'est demandé ou s'il est illisible.
- "identifier" : l'identifiant demandé, recopié tel qu'il est affiché. null si rien n'est demandé ou s'il est illisible.
- "problems" : si la capture n'est pas conforme, les raisons en français, courtes, en tutoyant le membre
  (ex. « On voit l'image de la vidéo en haut : recadre ta capture. »). Vide si elle est conforme.
- "summary" : une phrase en français qui décrit ce que montre la capture.
Ne calcule aucun point et n'invente aucun chiffre.`;

function userPrompt(i: ScreenshotInput) {
  return [
    `Type de résultat : ${i.typeName}`,
    i.instructions && `Consigne donnée au membre : ${i.instructions}`,
    `Doit se trouver sur la capture : ${i.mustHave || "(rien de précis)"}`,
    `Ne doit surtout pas se trouver sur la capture : ${i.mustNotHave || "(rien de précis)"}`,
    `Code du jour à trouver sur la capture : ${i.dailyCode}`,
    `Chiffre à lire : ${i.metricRead || "aucun (metricValue = null)"}`,
    `Identifiant à lire : ${i.identifier || "aucun (identifier = null)"}`,
    `Titre écrit par le membre (pour contexte, ne pas s'y fier) : ${i.title}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export class ClaudeScreenshotReader implements ScreenshotReader {
  private client: Anthropic;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  async read(input: ScreenshotInput): Promise<ScreenshotVerdict> {
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        // Si le modèle décline la demande (filtre de sécurité), l'API la relance sur un autre modèle.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: { effort: "medium", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: input.image.mime, data: input.image.data.toString("base64") } },
              { type: "text", text: userPrompt(input) },
            ],
          },
        ],
      } as Parameters<typeof this.client.beta.messages.create>[0]);
    } catch (e) {
      if (e instanceof Anthropic.APIError) throw new AIError(`Claude : erreur ${e.status ?? "réseau"} (${e.message.slice(0, 200)})`);
      throw e;
    }
    if (!("content" in response)) throw new AIError("Claude : réponse inattendue.");
    if (response.stop_reason === "refusal") throw new AIError("Claude a refusé de lire cette capture.");
    if (response.stop_reason === "max_tokens") throw new AIError("Claude : réponse coupée.");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let parsed;
    try {
      parsed = screenshotVerdict.parse(JSON.parse(text));
    } catch {
      throw new AIError("Claude : réponse illisible.");
    }
    return { ...parsed, model: response.model };
  }
}

// IA simulée (développement et tests) : « [FAIL] » dans le titre = capture non conforme, « [PANNE] » = panne ;
// le premier nombre du titre est le chiffre lu (ex. « 634000 vues »).
export class MockScreenshotReader implements ScreenshotReader {
  async read(input: ScreenshotInput): Promise<ScreenshotVerdict> {
    if (input.title.includes("[PANNE]")) throw new AIError("panne simulée");
    const fail = input.title.includes("[FAIL]");
    const number = /(\d[\d\s.]*)/.exec(input.title)?.[1]?.replace(/[\s.]/g, "");
    return {
      conforms: !fail,
      problems: fail ? ["On voit l'image de la vidéo en haut : recadre ta capture (IA simulée)."] : [],
      codeFound: !fail,
      forbiddenFound: fail,
      metricValue: input.metricRead && number ? Number(number) : null,
      identifier: input.identifier ? `simulé ${input.title.slice(0, 20)}` : null,
      summary: "Capture lue par l'IA simulée.",
      model: "mock",
    };
  }
}
