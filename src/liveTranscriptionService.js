import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { hasUsableOpenAiKey, openAiApiKey } from "./openaiConfig.js";

const DEFAULT_CHUNK_SECONDS = Number(process.env.TRANSCRIPT_CHUNK_SECONDS || 18);
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
const CMB_YOUTUBE_LIVE_URL = "https://www.youtube.com/cityofmiamibeach";
const YTDLP_COOKIES_BASE64 = process.env.YTDLP_COOKIES_BASE64 || process.env.YOUTUBE_COOKIES_BASE64;
const YTDLP_COOKIES_PATH = process.env.YTDLP_COOKIES_PATH || process.env.YOUTUBE_COOKIES_PATH;

function setupError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function commandAvailable(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0;
}

function isLikelyDirectMediaUrl(value) {
  return /\.(m3u8|mp3|m4a|aac|wav|mp4)(?:$|\?)/i.test(String(value || ""));
}

function normalizeSourceUrl(value) {
  const sourceUrl = String(value || "").trim();
  if (
    /^https?:\/\/(?:www\.)?youtube\.com\/cityofmiamibeach\/?$/i.test(sourceUrl) ||
    /^https?:\/\/(?:www\.)?youtube\.com\/c\/CityofMiamiBeachTV(?:\/live)?\/?$/i.test(sourceUrl) ||
    /^https?:\/\/(?:www\.)?youtube\.com\/@cityofmiamibeach(?:\/live)?\/?$/i.test(sourceUrl)
  ) {
    return CMB_YOUTUBE_LIVE_URL;
  }
  return sourceUrl;
}

function compactJob(job) {
  if (!job) return null;
  return {
    sessionId: job.sessionId,
    sourceUrl: job.sourceUrl,
    status: job.status,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    chunksSeen: job.seen.size,
    chunksTranscribed: job.chunksTranscribed,
    lastTranscriptAt: job.lastTranscriptAt,
    lastError: job.lastError
  };
}

export class LiveTranscriptionService {
  constructor({ assistant, rootDir }) {
    this.assistant = assistant;
    this.rootDir = rootDir;
    this.jobs = new Map();
  }

  readiness() {
    return {
      openAiConfigured: hasUsableOpenAiKey(),
      ffmpegAvailable: commandAvailable("ffmpeg", ["-version"]),
      ytDlpAvailable: commandAvailable("yt-dlp", ["--version"]),
      youtubeCookiesConfigured: Boolean(YTDLP_COOKIES_PATH || YTDLP_COOKIES_BASE64),
      model: OPENAI_TRANSCRIBE_MODEL,
      chunkSeconds: DEFAULT_CHUNK_SECONDS
    };
  }

  status(sessionId) {
    if (sessionId) return compactJob(this.jobs.get(sessionId));
    return {
      readiness: this.readiness(),
      jobs: [...this.jobs.values()].map(compactJob)
    };
  }

  async start({ sessionId, sourceUrl }) {
    const readiness = this.readiness();
    if (!readiness.openAiConfigured) {
      throw setupError("A valid OPENAI_API_KEY is required before live transcription can start.");
    }
    if (!readiness.ffmpegAvailable) {
      throw setupError("ffmpeg is required before live transcription can start.");
    }

    await this.stop(sessionId, { silent: true });

    const session = this.assistant.getSession(sessionId);
    if (!session) throw setupError("Session not found.");

    const selectedSourceUrl = normalizeSourceUrl(sourceUrl || session.sourceUrl || process.env.CMB_DEFAULT_LIVE_URL);
    if (!selectedSourceUrl) throw setupError("A live source URL is required.");

    const workDir = path.join(this.rootDir, "data", "live", sessionId);
    await fs.rm(workDir, { recursive: true, force: true });
    await fs.mkdir(workDir, { recursive: true });

    const job = {
      sessionId,
      sourceUrl: selectedSourceUrl,
      status: "starting",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seen: new Set(),
      chunksTranscribed: 0,
      lastTranscriptAt: null,
      lastError: null,
      workDir,
      ffmpeg: null,
      pollTimer: null
    };
    this.jobs.set(sessionId, job);
    this.assistant.setSessionStatus(sessionId, "starting", { sourceUrl: selectedSourceUrl });

    try {
      const mediaUrl = await this.resolveMediaUrl(selectedSourceUrl);
      job.status = "live";
      job.updatedAt = new Date().toISOString();
      this.assistant.setSessionStatus(sessionId, "live", { sourceUrl: selectedSourceUrl });
      this.spawnFfmpeg(job, mediaUrl);
      job.pollTimer = setInterval(() => this.processChunks(job).catch((error) => this.noteError(job, error)), 4000);
      return compactJob(job);
    } catch (error) {
      this.noteError(job, error);
      this.assistant.setSessionStatus(sessionId, "error");
      this.jobs.delete(sessionId);
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async stop(sessionId, { silent = false } = {}) {
    const job = this.jobs.get(sessionId);
    if (!job) return null;
    if (job.pollTimer) clearInterval(job.pollTimer);
    if (job.ffmpeg && !job.ffmpeg.killed) job.ffmpeg.kill("SIGTERM");
    job.status = "stopped";
    job.updatedAt = new Date().toISOString();
    await this.processChunks(job).catch(() => {});
    this.jobs.delete(sessionId);
    if (!silent) this.assistant.setSessionStatus(sessionId, "idle");
    return compactJob(job);
  }

  async resolveMediaUrl(sourceUrl) {
    if (isLikelyDirectMediaUrl(sourceUrl) || !commandAvailable("yt-dlp", ["--version"])) {
      return sourceUrl;
    }

    const ytDlpArgs = [
      "--force-ipv4",
      "-f",
      "ba/b",
      "--js-runtimes",
      "node",
      ...await this.ytDlpCookieArgs(),
      "-g",
      sourceUrl
    ];
    const result = spawnSync("yt-dlp", ytDlpArgs, {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });

    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "yt-dlp could not resolve the live source.").trim());
    }

    const mediaUrl = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
    if (!mediaUrl) throw new Error("yt-dlp did not return a media URL.");
    return mediaUrl;
  }

  async ytDlpCookieArgs() {
    if (YTDLP_COOKIES_PATH) return ["--cookies", YTDLP_COOKIES_PATH];
    if (!YTDLP_COOKIES_BASE64) return [];

    const cookiesPath = path.join(this.rootDir, "data", "runtime", "youtube-cookies.txt");
    await fs.mkdir(path.dirname(cookiesPath), { recursive: true });
    await fs.writeFile(cookiesPath, Buffer.from(YTDLP_COOKIES_BASE64, "base64"));
    return ["--cookies", cookiesPath];
  }

  spawnFfmpeg(job, mediaUrl) {
    const pattern = path.join(job.workDir, "chunk-%06d.wav");
    const args = [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-nostdin",
      "-i",
      mediaUrl,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "segment",
      "-segment_time",
      String(DEFAULT_CHUNK_SECONDS),
      "-segment_format",
      "wav",
      "-reset_timestamps",
      "1",
      pattern
    ];

    job.ffmpeg = spawn("ffmpeg", args, { windowsHide: true });
    job.ffmpeg.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8").trim();
      if (text) job.lastError = text.slice(-500);
    });
    job.ffmpeg.on("close", (code) => {
      if (this.jobs.get(job.sessionId) !== job) return;
      if (job.status !== "stopped") {
        job.status = code === 0 ? "idle" : "error";
        job.updatedAt = new Date().toISOString();
        this.assistant.setSessionStatus(job.sessionId, job.status === "error" ? "error" : "idle");
      }
    });
  }

  async processChunks(job) {
    const files = (await fs.readdir(job.workDir).catch(() => []))
      .filter((file) => /^chunk-\d+\.wav$/i.test(file))
      .sort();

    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(job.workDir, file);
      if (job.seen.has(filePath)) continue;
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat || now - stat.mtimeMs < 3000 || stat.size < 2000) continue;
      job.seen.add(filePath);
      const text = await this.transcribeFile(filePath);
      if (!text) continue;
      job.chunksTranscribed += 1;
      job.lastTranscriptAt = new Date().toISOString();
      job.updatedAt = job.lastTranscriptAt;
      await this.assistant.addTranscript(job.sessionId, {
        speaker: "Live audio",
        text,
        isFinal: true,
        at: job.lastTranscriptAt
      });
    }
  }

  async transcribeFile(filePath) {
    const bytes = await fs.readFile(filePath);
    const form = new FormData();
    form.set("model", OPENAI_TRANSCRIBE_MODEL);
    form.set("file", new Blob([bytes], { type: "audio/wav" }), path.basename(filePath));
    form.set("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey()}`
      },
      body: form
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI transcription failed: ${response.status} ${body.slice(0, 300)}`);
    }

    const payload = await response.json();
    return String(payload.text || "").trim();
  }

  noteError(job, error) {
    job.status = "error";
    job.updatedAt = new Date().toISOString();
    job.lastError = error.message;
  }
}
