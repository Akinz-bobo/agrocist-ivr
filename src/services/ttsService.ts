import config from "../config";
import logger from "../utils/logger";
import cloudinaryService from "./cloudinaryService";
import localAudioService from "./localAudioService";
import Spitch from "spitch";

export interface TTSOptions {
  language: "en" | "yo" | "ha" | "ig";
}

// Spitch voice names mapped to each supported language
const VOICE_MAP: Record<string, string> = {
  en: "john",
  ha: "amina",
  ig: "amara",
  yo: "sade",
};

// Rough estimate: 10 characters ≈ 1 second of speech
function estimateAudioDuration(text: string): number {
  return Math.ceil(text.length / 10);
}

export interface TTSResponse {
  audioUrl: string;
  duration: number;
  language: string;
  processingTime: number;
  provider: string;
}

class TTSService {
  private client: Spitch;

  constructor() {
    this.client = new Spitch({ apiKey: config.spitch.apiKey });
  }

  /**
   * Generate TTS audio for an AI response and return a hosted URL.
   * Uses Spitch for all languages. Falls back to Cloudinary → local file → base64.
   */
  async generateAIAudio(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string,
    sessionId?: string
  ): Promise<TTSResponse> {
    return this.generateWithSpitch(text, language, sessionId);
  }

  /**
   * Generate audio via the Spitch TTS API.
   * Retries up to 2 times on transient socket/network errors.
   * Uploads the resulting buffer to Cloudinary (or local storage as fallback).
   */
  async generateWithSpitch(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    sessionId?: string
  ): Promise<TTSResponse> {
    const voice = VOICE_MAP[language] ?? "john";

    logger.info("Spitch TTS request", { text, language, voice, sessionId });

    // Retry logic for transient network errors
    const MAX_RETRIES = 2;
    let lastError: unknown;
    let audioBuffer: Buffer | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.speech.generate({
          text,
          language,
          voice: voice as any,
          format: "mp3",
          model: "legacy",
        });

        const blob = await response.blob();
        audioBuffer = Buffer.from(await blob.arrayBuffer());
        break; // success — exit retry loop
      } catch (err: any) {
        lastError = err;
        const isRetryable =
          err?.cause?.code === "UND_ERR_SOCKET" ||
          err?.message?.includes("terminated") ||
          err?.message?.includes("ECONNRESET");

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 500;
          logger.warn(
            `Spitch attempt ${attempt + 1} failed (${err?.cause?.code ?? err?.message}), retrying in ${delay}ms...`
          );
          await new Promise((r) => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }

    if (!audioBuffer) throw lastError;

    // Upload audio buffer — Cloudinary preferred, local filesystem as fallback
    const audioUrl = await this.uploadAudioBuffer(audioBuffer, language, sessionId);

    return {
      audioUrl,
      duration: estimateAudioDuration(text),
      language,
      processingTime: 0,
      provider: "spitch",
    };
  }

  /**
   * Upload an audio buffer to Cloudinary, falling back to local storage,
   * and finally to a base64 data URL if both fail.
   */
  private async uploadAudioBuffer(
    buffer: Buffer,
    language: string,
    sessionId?: string
  ): Promise<string> {
    const filename = `spitch_${Date.now()}_${sessionId?.slice(-8) ?? "unknown"}.mp3`;

    try {
      const result = await cloudinaryService.uploadAudioBuffer(buffer, {
        type: "dynamic",
        language,
        filename,
      });
      if (result?.secureUrl) return result.secureUrl;
    } catch (uploadError) {
      logger.warn("Cloudinary upload failed, trying local fallback", { uploadError, sessionId });
    }

    // Local filesystem fallback
    try {
      const localUrl = await localAudioService.saveAudioBuffer(buffer, {
        type: "dynamic",
        language,
        filename: `spitch_fallback_${filename}`,
      });
      if (localUrl) return `${config.webhook.baseUrl}${localUrl}`;
    } catch {
      // ignore — fall through to base64
    }

    // Last resort: inline base64 data URL
    return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
  }
}

export default new TTSService();
