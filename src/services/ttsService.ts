import config from "../config";
import logger from "../utils/logger";
import cloudinaryService from "./cloudinaryService";
import localAudioService from "./localAudioService";
import Spitch from "spitch";

export interface TTSOptions {
  language: "en" | "yo" | "ha" | "ig";
}

enum SupportedLanguage {
  ENGLISH = "en",
  YORUBA = "yo",
  HAUSA = "ha",
  IGBO = "ig",
}

interface TTSResponse {
  audioUrl: string;
  duration: number;
  language: string;
  processingTime: number;
  provider: string;
}

function estimateAudioDuration(text: string): number {
  return Math.ceil(text.length / 10); // Rough estimate: 10 chars per second
}

class TTSService {
  private client: Spitch;

  constructor() {
    this.client = new Spitch({
      apiKey: config.spitch.apiKey,
    });
  }

  async generateAIAudio(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string,
    sessionId?: string
  ): Promise<TTSResponse> {
    try {
      // Use ElevenLabs for English, Spitch for other languages
      if (language === "en") {
        return await this.generateWithElevenLabs(text, language, sessionId);
      } else {
        return await this.generateWithSpitch(text, language, sessionId);
      }
    } catch (error) {
      logger.error("TTS generation failed", { error, sessionId, language });
      throw error;
    }
  }

  private async generateWithElevenLabs(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    sessionId?: string
  ): Promise<TTSResponse> {
    try {
      const ElevenLabsClient = (await import("@elevenlabs/elevenlabs-js")).ElevenLabsClient;
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY,
      });

      logger.info("ElevenLabs TTS request", {
        text,
        language,
        sessionId,
      });

      const audioStream = await client.textToSpeech.convert(
        process.env.ELEVENLABS_VOICE_ID_EN || "V0PuVTP8lJVnkKNavZmc",
        {
          text,
          modelId: "eleven_multilingual_v2",
          outputFormat: "mp3_44100_128",
        }
      );

      // Convert ReadableStream to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);

      // Upload to Cloudinary as dynamic audio
      let audioUrl: string;
      try {
        const uploadResult = await cloudinaryService.uploadAudioBuffer(
          audioBuffer,
          {
            type: "dynamic",
            language,
            filename: `elevenlabs_${Date.now()}_${
              sessionId?.slice(-8) || "unknown"
            }.mp3`,
          }
        );
        audioUrl =
          uploadResult?.secureUrl ||
          `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
      } catch (uploadError) {
        logger.warn("Cloudinary upload failed, using local file fallback", {
          uploadError,
          sessionId,
        });
        const localUrl = await localAudioService.saveAudioBuffer(audioBuffer, {
          type: "dynamic",
          language,
          filename: `elevenlabs_fallback_${Date.now()}_${
            sessionId?.slice(-8) || "unknown"
          }.mp3`,
        });
        audioUrl = localUrl
          ? `${config.webhook.baseUrl}${localUrl}`
          : `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
      }

      return {
        audioUrl,
        duration: estimateAudioDuration(text),
        language,
        processingTime: 0,
        provider: "elevenlabs",
      };
    } catch (error) {
      logger.error("ElevenLabs TTS generation failed", { error, sessionId });
      throw error;
    }
  }

  private async generateWithSpitch(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    sessionId?: string
  ): Promise<TTSResponse> {
    try {
      type SpitchVoice =
        | "amina"
        | "ebuka"
        | "femi"
        | "sade"
        | "segun"
        | "funmi"
        | "aliyu"
        | "hasan"
        | "zainab"
        | "john"
        | "jude"
        | "lina"
        | "lucy"
        | "henry"
        | "kani"
        | "ngozi"
        | "amara"
        | "obinna"
        | "hana"
        | "selam"
        | "tena"
        | "tesfaye";

      const voiceMap: Record<string, SpitchVoice> = {
        en: "john",
        ha: "amina",
        ig: "amara",
        yo: "sade",
      };

      const selectedVoice = voiceMap[language] || "john";

      logger.info("Spitch TTS request", {
        text,
        language,
        voice: selectedVoice,
        sessionId,
      });

      const response = await this.client.speech.generate({
        text,
        language,
        voice: selectedVoice,
        format: "mp3",
        model: "legacy",
      });

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Upload to Cloudinary as dynamic audio
      let audioUrl: string;
      try {
        const uploadResult = await cloudinaryService.uploadAudioBuffer(
          audioBuffer,
          {
            type: "dynamic",
            language,
            filename: `spitch_${Date.now()}_${
              sessionId?.slice(-8) || "unknown"
            }.mp3`,
          }
        );
        audioUrl =
          uploadResult?.secureUrl ||
          `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
      } catch (uploadError) {
        logger.warn("Cloudinary upload failed, using local file fallback", {
          uploadError,
          sessionId,
        });
        const localUrl = await localAudioService.saveAudioBuffer(audioBuffer, {
          type: "dynamic",
          language,
          filename: `spitch_fallback_${Date.now()}_${
            sessionId?.slice(-8) || "unknown"
          }.mp3`,
        });
        audioUrl = localUrl
          ? `${config.webhook.baseUrl}${localUrl}`
          : `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
      }

      return {
        audioUrl,
        duration: estimateAudioDuration(text),
        language,
        processingTime: 0,
        provider: "spitch",
      };
    } catch (error) {
      logger.error("Spitch TTS generation failed", { error, sessionId });
      throw error;
    }
  }
}

export default new TTSService();
