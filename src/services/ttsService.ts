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
