import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import logger from './logger';

class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  async generateAudio(text: string, language: "en" | "yo" | "ha" | "ig"): Promise<Buffer | null> {
    try {
      const voiceConfigs = {
        en: process.env.ELEVENLABS_VOICE_ID_EN || "21m00Tcm4TlvDq8ikWAM",
        yo: process.env.ELEVENLABS_VOICE_ID_YO || "21m00Tcm4TlvDq8ikWAM", 
        ha: process.env.ELEVENLABS_VOICE_ID_HA || "21m00Tcm4TlvDq8ikWAM",
        ig: process.env.ELEVENLABS_VOICE_ID_IG || "21m00Tcm4TlvDq8ikWAM",
      };

      const voiceId = voiceConfigs[language];
      const startTime = Date.now();

      const audioStream = await this.client.textToSpeech.convert(voiceId, {
        text,
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
      });

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      const requestTime = Date.now() - startTime;
      logger.info(`ElevenLabs TTS success: ${buffer.length} bytes in ${requestTime}ms`);
      return buffer;
    } catch (error: any) {
      logger.error('ElevenLabs TTS request failed:', error.message);
      return null;
    }
  }
}

export default new ElevenLabsService();