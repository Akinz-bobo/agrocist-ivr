import config from "../config";
import logger from "../utils/logger";
import cloudinaryService from "./cloudinaryService";
import localAudioService from "./localAudioService";
import dsnService from "../utils/DSNService";
import elevenLabsService from "../utils/ElevenLabsService";

export interface TTSOptions {
  language: "en" | "yo" | "ha" | "ig";
}

class TTSService {
  // Voice configurations for each language using DSN service
  private voiceConfigs = {
    en: { voiceId: "lucy", language: "en" },
    yo: { voiceId: "sade", language: "yo" },
    ha: { voiceId: "zainab", language: "ha" },
    ig: { voiceId: "amara", language: "ig" },
  };

  async generateAIAudio(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string,
  ): Promise<string> {
    try {
       const voiceConfig = this.voiceConfigs[language];
      let buffer: Buffer | null = null;
      let provider: string = ''

      if (voiceConfig.language ==='en') {
        provider = 'ElevenLabs';
        buffer = await elevenLabsService.generateAudio(text, language);
      } else {
        provider = 'DSN';
        if (!voiceConfig) {
          throw new Error(`No voice configuration found for language: ${language}`);
        }
        buffer = await dsnService.makeDSNRequest(text, voiceConfig);
      }

      if (!buffer) {
        throw new Error(`Failed to generate audio from ${provider} service`);
      }

      // Upload to storage (local first, then Cloudinary)
      if (localAudioService.isEnabled() || cloudinaryService.isEnabled()) {
        const timestamp = Date.now();
        const cloudinaryResult = await cloudinaryService.uploadAudioBuffer(
          buffer,
          {
            folder: config.cloudinary.folder,
            filename: `dynamic_spitch_${phoneNumber}_${language}_${timestamp}`,
            type: 'dynamic',
            language
          }
        );

        if (cloudinaryResult) {
          logger.info(`✅ Uploaded fresh AI audio to Cloudinary: ${cloudinaryResult.secureUrl}`);
          return cloudinaryResult.secureUrl;
        } else {
          logger.warn("Audio upload failed, falling back to data URL");
        }
      }

      // Fallback to data URL if Cloudinary is disabled or upload failed
      const base64 = buffer.toString("base64");
      const dataUrl = `data:audio/mp3;base64,${base64}`;
      logger.info(`Generated data URL for AI audio (${buffer.length} bytes)`);
      return dataUrl;
    } catch (error: any) {
      logger.error(`TTS generation failed for ${language}: ${error.message}`);
      throw new Error(`AI audio generation failed: ${error.message || "Unknown error"}`);
    }
  }

  async preAuthenticate(): Promise<void> {
    await dsnService.preAuthenticate();
  }
}

export default new TTSService();
