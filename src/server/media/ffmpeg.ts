import { spawn } from "node:child_process";

// Analyse des médias avec ffprobe / ffmpeg (exécuté par le worker ou, pour ffprobe seul, à l'envoi).

export class MediaError extends Error {}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new MediaError(`${cmd} timeout`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 5_000_000) stderr = stderr.slice(-2_000_000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new MediaError(`${cmd} failed to start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

export interface ProbeResult {
  formatName: string;
  durationSeconds: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
}

export async function probe(path: string): Promise<ProbeResult> {
  const { stdout, code } = await run(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    20_000,
  );
  if (code !== 0) throw new MediaError("ffprobe: fichier illisible");
  const json = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: { codec_type?: string; width?: number; height?: number; disposition?: { attached_pic?: number } }[];
  };
  const streams = json.streams ?? [];
  // Une pochette d'album (image attachée à un MP3) n'est pas une vidéo.
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  return {
    formatName: json.format?.format_name ?? "",
    durationSeconds: Number(json.format?.duration ?? 0),
    hasVideo: Boolean(video),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    width: video?.width ?? null,
    height: video?.height ?? null,
  };
}

// Changements de plan : seuil de score de scène (0 à 1). Renvoie les instants en secondes.
export async function detectCuts(path: string, threshold = 0.3): Promise<number[]> {
  const { stderr, code } = await run(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", path, "-an", "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
    180_000,
  );
  if (code !== 0) throw new MediaError("ffmpeg: détection des cuts impossible");
  return [...stderr.matchAll(/showinfo.*?pts_time:\s*([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * 100) / 100);
}

// Silences d'au moins `minSeconds` sous `noiseDb`.
export async function detectSilences(path: string, minSeconds = 0.5, noiseDb = -35) {
  const { stderr, code } = await run(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", path, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minSeconds}`, "-f", "null", "-"],
    180_000,
  );
  if (code !== 0) throw new MediaError("ffmpeg: détection des silences impossible");
  const silences: { start: number; end: number; duration: number }[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (e && start !== null) {
      silences.push({ start: round(start), end: round(Number(e[1])), duration: round(Number(e[2])) });
      start = null;
    }
  }
  return silences;
}

const round = (n: number) => Math.round(n * 100) / 100;

// Version légère pour la future consultation par le coach : 720p, H.264, AAC, MP4.
export async function transcodePreview(input: string, output: string) {
  const { code } = await run(
    "ffmpeg",
    [
      "-hide_banner", "-y", "-i", input,
      "-vf", "scale='min(720,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", output,
    ],
    600_000,
  );
  if (code !== 0) throw new MediaError("ffmpeg: transcodage impossible");
}
