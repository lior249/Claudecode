import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { z } from "zod";
import { AIError, type AIAnalysis, type Analyst, type AnalyzeInput, type Grader, type GradeInput, type Grading, type MediaInput } from "./types";
import { ANALYSIS_SCHEMA, ANALYST_SYSTEM, analystPrompt, GRADER_SYSTEM, graderPrompt, GRADING_SCHEMA } from "./prompts";

const BASE = "https://generativelanguage.googleapis.com";

// Accès bas niveau à l'API Gemini : envoi de fichiers (API Files) et génération JSON structurée.
export class GeminiClient {
  constructor(
    private apiKey: string,
    private timeoutMs = 300_000,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { "x-goog-api-key": this.apiKey, ...extra };
  }

  async uploadFile(media: MediaInput) {
    const { size } = await stat(media.path);
    const start = await fetch(`${BASE}/upload/v1beta/files`, {
      method: "POST",
      headers: this.headers({
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": media.mimeType,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ file: { display_name: media.originalName.slice(0, 100) } }),
      signal: AbortSignal.timeout(30_000),
    });
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!start.ok || !uploadUrl) throw new AIError(`Gemini upload start ${start.status}`);

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
      body: Readable.toWeb(createReadStream(media.path)) as ReadableStream,
      duplex: "half",
      signal: AbortSignal.timeout(this.timeoutMs),
    } as RequestInit);
    if (!res.ok) throw new AIError(`Gemini upload ${res.status}`);
    let file = ((await res.json()) as { file: GeminiFile }).file;

    // Les vidéos sont préparées par Google avant d'être utilisables.
    const deadline = Date.now() + this.timeoutMs;
    while (file.state === "PROCESSING") {
      if (Date.now() > deadline) throw new AIError("Gemini file processing timeout");
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`${BASE}/v1beta/${file.name}`, { headers: this.headers(), signal: AbortSignal.timeout(30_000) });
      if (!poll.ok) throw new AIError(`Gemini file poll ${poll.status}`);
      file = await poll.json();
    }
    if (file.state !== "ACTIVE") throw new AIError(`Gemini file state ${file.state}`);
    return file;
  }

  async deleteFile(name: string) {
    await fetch(`${BASE}/v1beta/${name}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }

  async generateJson(opts: { model: string; system: string; parts: unknown[]; schema: unknown }): Promise<unknown> {
    const res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: opts.schema },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new AIError(`Gemini ${opts.model} ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const raw = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text);
    } catch {
      throw new AIError(`Gemini ${opts.model} : réponse illisible`);
    }
  }
}

interface GeminiFile {
  name: string;
  uri: string;
  state: string;
  mimeType: string;
}

const analysisSchema = z.object({
  summary: z.string(),
  transcript: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })),
  shots: z.array(z.object({ start: z.number(), end: z.number(), description: z.string() })),
  soundEvents: z.array(z.object({ time: z.number(), description: z.string() })),
  onScreenText: z.array(z.object({ time: z.number(), text: z.string() })),
  comparisonWithReference: z.string(),
});

// Analyste : reçoit la vidéo/l'audio (et la référence), regardés à `fps` images par seconde.
export class GeminiAnalyst implements Analyst {
  constructor(
    private client: GeminiClient,
    private model: string,
    private fps: number,
  ) {}

  async analyze(input: AnalyzeInput): Promise<AIAnalysis> {
    const files: GeminiFile[] = [];
    try {
      for (const m of [input.media, input.reference].filter((x): x is MediaInput => x !== null)) {
        files.push(await this.client.uploadFile(m));
      }
      const parts = [
        ...files.map((f) => ({
          fileData: { mimeType: f.mimeType, fileUri: f.uri },
          ...(f.mimeType.startsWith("video/") ? { videoMetadata: { fps: this.fps } } : {}),
        })),
        { text: analystPrompt(input) },
      ];
      const json = await this.client.generateJson({ model: this.model, system: ANALYST_SYSTEM, parts, schema: ANALYSIS_SCHEMA });
      const parsed = analysisSchema.safeParse(json);
      if (!parsed.success) throw new AIError("analyste : rapport incomplet");
      return { ...parsed.data, model: this.model };
    } catch (e) {
      throw e instanceof AIError ? e : new AIError(`analyste : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      for (const f of files) await this.client.deleteFile(f.name);
    }
  }
}

const gradingSchema = z.object({
  criteria: z.array(
    z.object({
      criterionId: z.string(),
      misses: z.number(),
      evidence: z.array(z.object({ time: z.number().nullable().optional(), detail: z.string() })),
      comment: z.string(),
    }),
  ),
  feedback: z.string(),
});

// Correcteur : texte seulement (consigne + critères + rapport).
export class GeminiGrader implements Grader {
  constructor(
    private client: GeminiClient,
    private model: string,
  ) {}

  async grade(input: GradeInput): Promise<Grading> {
    try {
      const json = await this.client.generateJson({
        model: this.model,
        system: GRADER_SYSTEM,
        parts: [{ text: graderPrompt(input) }],
        schema: GRADING_SCHEMA,
      });
      const parsed = gradingSchema.safeParse(json);
      if (!parsed.success) throw new AIError("correcteur : réponse incomplète");
      return {
        criteria: parsed.data.criteria.map((c) => ({ ...c, evidence: c.evidence.map((e) => ({ time: e.time ?? null, detail: e.detail })) })),
        feedback: parsed.data.feedback,
        model: this.model,
      };
    } catch (e) {
      throw e instanceof AIError ? e : new AIError(`correcteur : ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
