import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import logger from './logger';

class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }

  async generateAudio(text: string, language: "en" | "yo" | "ha" | "ig", sessionId?: string): Promise<Buffer | null> {
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
      const sessionInfo = sessionId ? ` [${sessionId.slice(-8)}]` : '';
      logger.info(`ElevenLabs TTS${sessionInfo}: ${buffer.length} bytes in ${requestTime}ms`);
      return buffer;
    } catch (error: any) {
      const sessionInfo = sessionId ? ` [${sessionId.slice(-8)}]` : '';
      logger.error(`ElevenLabs TTS${sessionInfo} failed:`, error.message);
      return null;
    }
  }
}

export default new ElevenLabsService();