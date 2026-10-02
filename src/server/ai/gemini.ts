import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { z } from "zod";
import { AIError, type AIEvaluation, type AIEvaluationInput, type AIProvider } from "./types";
import { buildUserPrompt, RESPONSE_SCHEMA, SYSTEM_PROMPT } from "./prompt";

const BASE = "https://generativelanguage.googleapis.com";

const responseSchema = z.object({
  criteria: z.array(z.object({ name: z.string(), maxPoints: z.number(), pointsLost: z.number(), comment: z.string() })),
  feedback: z.string(),
});

// Correcteur Gemini : envoie les médias via l'API Files, puis demande une réponse JSON structurée.
export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string,
    private timeoutMs = 180_000,
  ) {}

  private headers(extra: Record<string, string> = {}) {
    return { "x-goog-api-key": this.apiKey, ...extra };
  }

  private async uploadFile(path: string, mimeType: string, displayName: string) {
    const { size } = await stat(path);
    const start = await fetch(`${BASE}/upload/v1beta/files`, {
      method: "POST",
      headers: this.headers({
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ file: { display_name: displayName.slice(0, 100) } }),
      signal: AbortSignal.timeout(30_000),
    });
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (!start.ok || !uploadUrl) throw new AIError(`Gemini upload start ${start.status}`);

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
      body: Readable.toWeb(createReadStream(path)) as ReadableStream,
      duplex: "half",
      signal: AbortSignal.timeout(this.timeoutMs),
    } as RequestInit);
    if (!res.ok) throw new AIError(`Gemini upload ${res.status}`);
    let file = ((await res.json()) as { file: { name: string; uri: string; state: string; mimeType: string } }).file;

    // Les vidéos sont traitées par Google avant d'être utilisables.
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

  private async deleteFile(name: string) {
    await fetch(`${BASE}/v1beta/${name}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }

  async evaluate(input: AIEvaluationInput): Promise<AIEvaluation> {
    const uploaded: { name: string; uri: string; mimeType: string }[] = [];
    try {
      for (const m of input.media) uploaded.push(await this.uploadFile(m.path, m.mimeType, m.originalName));
      const res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: this.headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [
                ...uploaded.map((f) => ({ file_data: { mime_type: f.mimeType, file_uri: f.uri } })),
                { text: buildUserPrompt(input) },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new AIError(`Gemini generateContent ${res.status}: ${(await res.text()).slice(0, 500)}`);
      const raw = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      let parsed;
      try {
        parsed = responseSchema.parse(JSON.parse(text));
      } catch {
        throw new AIError("Gemini: réponse illisible");
      }
      return { ...parsed, model: this.model, raw };
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError(`Gemini: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      for (const f of uploaded) await this.deleteFile(f.name);
    }
  }
}
