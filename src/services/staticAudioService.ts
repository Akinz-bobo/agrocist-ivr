import ttsService, { TTSOptions } from './ttsService';
import logger from '../utils/logger';
import cloudinaryService from './cloudinaryService';
import config from '../config';

export interface StaticAudioTexts {
  welcome: string;
  processing: string;
  error: string;
  goodbye: string;
  noRecording: string;
  wait: string;
  directRecording: string;
  followUpRecording: string;
  postAIMenu: string;
  noInputMessage: string;
  transfer: string;
}

class StaticAudioService {
  private staticTexts: Record<string, StaticAudioTexts> = {
    en: {
      welcome: "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.",
      processing: "Thank you for your question. Agrocist is analyzing your concern.",
      error: "I'm sorry, I didn't understand that. Let me take you back to the main menu.",
      goodbye: "Thank you for using Agrocist. Have a great day!",
      noRecording: "I didn't hear your recording. Please try again and speak after the beep.",
      wait: "Just a moment, processing your request.",
      directRecording: "You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
      followUpRecording: "Please ask your next question or describe another livestock concern. Speak clearly after the beep and press hash when done.",
      postAIMenu: "Do you have any other concerns? Press 1 to ask another question, press 2 to speak with a human expert, press 3 to go back to main menu, or press 0 to end the call.",
      noInputMessage: "We did not receive your selection. Let me repeat the options.",
      transfer: "Please hold while I connect you to one of our veterinary experts."
    },
    yo: {
      welcome: "Ẹ káàbọ̀ sí Agrocist, alábáṣepọ̀ òwe ẹranko tí ẹ lè gbẹ́kẹ̀lé. Ẹ tẹ́ ọ̀kan fún Gẹ̀ẹ́sì, méjì fún Yorùbá, mẹ́ta fún Hausa, tàbí mẹ́rin fún Igbo.",
      processing: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín.",
      error: "Má bínú, kò yé mi ohun tí ẹ sọ. Ẹ jẹ́ kí n gbé yín padà sí àtòjọ àkọ́kọ́.",
      goodbye: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      noRecording: "Mi ò gbọ́ ìgbóhùn yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si, kí ẹ sì sọ̀rọ̀ lẹ́yìn ìró àlámọ́.",
      wait: "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín.",
      directRecording: "Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      followUpRecording: "Ẹ béèrè ìbéèrè yín tókàn tàbí ẹ sọ ìṣòro ẹranko mìíràn. Ẹ sọ̀rọ̀ kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      postAIMenu: "Ṣé ẹ ní ìṣòro mìíràn? Ẹ tẹ́ ọ̀kan láti béèrè ìbéèrè mìíràn, ẹ tẹ́ méjì láti bá amọ̀ràn sọ̀rọ̀, ẹ tẹ́ mẹ́ta láti padà sí àtòjọ àkọ́kọ́, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      noInputMessage: "A kò gbọ́ àṣàyàn yín. Ẹ jẹ́ kí n tún àwọn àṣàyàn náà sọ.",
      transfer: "Ẹ dúró síbẹ̀ kí n so yín mọ́ ọ̀kan lára àwọn amọ̀ràn oníwòsàn ẹranko wa."
    },
    ha: {
      welcome: "Maraba da zuwa Agrocist, abokin gona na kiwo da za ku iya dogara da shi. Danna 1 don Turanci, 2 don Yoruba, 3 don Hausa, ko 4 don Igbo.",
      processing: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku.",
      error: "Yi hakuri, ban fahimci hakan ba. Bari in mayar da ku zuwa babban menu.",
      goodbye: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
      noRecording: "Ban ji rikodin ku ba. Don Allah ku sake gwadawa kuma ku yi magana bayan sautin.",
      wait: "Don Allah ku ɗan jira, muna aiwatar da buƙatarku.",
      directRecording: "Kun zaɓi Hausa. Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
      followUpRecording: "Don Allah ku yi wata tambaya ko ku bayyana wata matsalar dabbobi. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
      postAIMenu: "Kana da wasu matsaloli? Danna 1 don yin wata tambaya, danna 2 don magana da ƙwararren likita, danna 3 don komawa babban menu, ko danna 0 don kammala kiran.",
      noInputMessage: "Ba mu karɓi zaɓin ku ba. Bari in sake maimaita zaɓukan.",
      transfer: "Don Allah ku jira yayin da nake haɗa ku da ɗaya daga cikin ƙwararrun likitocin dabbobinmu."
    },
    ig: {
      welcome: "Nnọọ na Agrocist, onye enyi gị n'ọrụ anụmanụ ị nwere ike ịdabere na ya. Pịa 1 maka Bekee, 2 maka Yoruba, 3 maka Hausa, ma ọ bụ 4 maka Igbo.",
      processing: "Daalụ maka ajụjụ gị. Agrocist na-enyocha nsogbu gị.",
      error: "Ewela iwe, aghọtaghị m ihe ị kwuru. Ka m laghachi gị na menu izizi.",
      goodbye: "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!",
      noRecording: "Anụghị m ndekọ gị. Biko gbalịa ọzọ ma kwuo okwu mgbe ụda ahụ gasịrị.",
      wait: "Chere ntakịrị, anyị na-edozi ihe ị chọrọ.",
      directRecording: "Ịhọrọla Igbo. Biko kọwaa nsogbu anụmanụ gị. Kwuo okwu n'ụzọ doro anya mgbe ụda ahụ (beep) gasịrị, wee pịa hash mgbe ị mechara.",
      followUpRecording: "Biko jụọ ajụjụ gị ọzọ ma ọ bụ kọwaa nsogbu anụmanụ ọzọ. Kwuo okwu n'ụzọ doro anya mgbe ụda ahụ (beep) gasịrị, wee pịa hash mgbe ị mechara.",
      postAIMenu: "Ị nwere nsogbu ndị ọzọ? Pịa 1 iji jụọ ajụjụ ọzọ, pịa 2 iji kwuo okwu na ọkachamara mmadụ, pịa 3 iji laghachi na menu izizi, ma ọ bụ pịa 0 iji kwụsị oku a.",
      noInputMessage: "Anyị anatabeghị nhọrọ gị. Ka m kwughachi nhọrọ ndị ahụ.",
      transfer: "Biko chere ka m jikọọ gị na otu n'ime ndị ọkachamara veterinary anyị."
    }
  };

  private staticAudioUrls: Map<string, string> = new Map();

  /**
   * Pre-generate all static audio files at startup
   */
  async preGenerateStaticAudio(): Promise<void> {
    logger.info('🎵 Starting static audio pre-generation...');
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    const languages: Array<'en' | 'yo' | 'ha' | 'ig'> = ['en', 'yo', 'ha', 'ig'];
    
    for (const language of languages) {
      logger.info(`🎵 Generating static audio for ${language}...`);
      const texts = this.staticTexts[language];
      
      if (!texts) {
        logger.error(`❌ No texts found for language: ${language}`);
        continue;
      }
      
      for (const [key, text] of Object.entries(texts)) {
        try {
          const options: TTSOptions = { language };
          const audioUrl = await ttsService.generateSpeech(text as string, options);
          
          // Store with key pattern: language_textKey (e.g., "en_welcome", "yo_processing")
          const cacheKey = `${language}_${key}`;
          
          // If Cloudinary is enabled, check for existing static files with proper naming
          let finalUrl = audioUrl;
          if (cloudinaryService.isEnabled()) {
            // Use the proper static naming pattern: static_welcome_en, static_processing_yo, etc.
            const staticPublicId = `static_${key}_${language}`;
            const existsOnCloudinary = await cloudinaryService.fileExists(staticPublicId);
            
            if (existsOnCloudinary) {
              // File already exists, use the existing URL
              const existingCloudinaryUrl = cloudinaryService.getOptimizedUrl(staticPublicId);
              if (existingCloudinaryUrl) {
                finalUrl = existingCloudinaryUrl;
                logger.info(`♻️ Using existing static Cloudinary file: ${cacheKey}`);
              }
            } else {
              // File doesn't exist, upload it with proper static naming
              const cloudinaryUrl = await this.uploadStaticToCloudinary(text as string, language, key);
              if (cloudinaryUrl) {
                finalUrl = cloudinaryUrl;
                logger.info(`📤 Uploaded new static audio to Cloudinary: ${cacheKey}`);
              }
            }
          }
          
          this.staticAudioUrls.set(cacheKey, finalUrl);
          
          successCount++;
          logger.info(`✅ Generated ${cacheKey}: ${(text as string).substring(0, 50)}...`);
        } catch (error) {
          failedCount++;
          logger.error(`❌ Failed to generate ${language}_${key}:`, error);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    logger.info(`🎵 Static audio pre-generation completed in ${totalTime}ms`);
    logger.info(`✅ Success: ${successCount}, ❌ Failed: ${failedCount}, Total: ${successCount + failedCount}`);
  }

  /**
   * Get pre-generated static audio URL
   */
  getStaticAudioUrl(language: 'en' | 'yo' | 'ha' | 'ig', textKey: keyof StaticAudioTexts): string | null {
    const cacheKey = `${language}_${textKey}`;
    return this.staticAudioUrls.get(cacheKey) || null;
  }

  /**
   * Get static text for fallback
   */
  getStaticText(language: 'en' | 'yo' | 'ha' | 'ig', textKey: keyof StaticAudioTexts): string {
    const languageTexts = this.staticTexts[language];
    const englishTexts = this.staticTexts.en;
    
    return languageTexts?.[textKey] || englishTexts?.[textKey] || '';
  }

  /**
   * Upload static audio file to Cloudinary directly from TTS buffer
   */
  private async uploadStaticToCloudinary(
    text: string, 
    language: string, 
    textKey: string
  ): Promise<string | null> {
    try {
      // Use simple static naming pattern: static_welcome_en, static_processing_yo, etc.
      const publicId = `static_${textKey}_${language}`;
      
      // Generate TTS audio buffer directly (don't save to disk)
      const audioBuffer = await this.generateTTSBuffer(text, language as 'en' | 'yo' | 'ha' | 'ig');
      if (!audioBuffer) {
        logger.warn(`Failed to generate TTS buffer for static audio: ${language}_${textKey}`);
        return null;
      }
      
      const cloudinaryResult = await cloudinaryService.uploadAudioBuffer(audioBuffer, {
        publicId,
        folder: `${config.cloudinary.folder}/static`
      });
      
      if (cloudinaryResult) {
        logger.info(`📤 Uploaded static audio directly to Cloudinary: ${cloudinaryResult.secureUrl}`);
        return cloudinaryResult.secureUrl;
      }
    } catch (error) {
      logger.warn(`Failed to upload static audio to Cloudinary: ${language}_${textKey}`, error);
    }
    
    return null;
  }

  /**
   * Generate TTS audio buffer without saving to disk
   */
  private async generateTTSBuffer(text: string, language: 'en' | 'yo' | 'ha' | 'ig'): Promise<Buffer | null> {
    try {
      const axios = require('axios');
      const FormData = require('form-data');
      
      // Reuse TTS authentication and generation logic
      const ttsService = (await import('./ttsService')).default;
      const token = await ttsService.authenticateDSN();
      
      if (!token) {
        throw new Error('Failed to authenticate with DSN API');
      }

      // Voice configurations
      const voiceConfigs: Record<string, any> = {
        en: { voiceId: 'lucy', language: 'en' },
        yo: { voiceId: 'sade', language: 'yo' },
        ha: { voiceId: 'zainab', language: 'ha' },
        ig: { voiceId: 'amara', language: 'ig' }
      };

      const voiceConfig = voiceConfigs[language];
      if (!voiceConfig) {
        throw new Error(`No voice configuration found for language: ${language}`);
      }

      // Create form data for the request
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', voiceConfig.language);
      formData.append('voice', voiceConfig.voiceId);
      formData.append('format', 'mp3');
      formData.append('quality', 'medium');
      formData.append('encoding', 'mp3_64');

      // Make request to DSN TTS API
      const response = await axios({
        method: 'POST',
        url: `${config.dsn.baseUrl}/api/v1/ai/spitch/text-to-speech`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Error generating TTS buffer:', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    size: number; 
    keys: string[];
    cloudinaryEnabled: boolean;
  } {
    return {
      size: this.staticAudioUrls.size,
      keys: Array.from(this.staticAudioUrls.keys()),
      cloudinaryEnabled: cloudinaryService.isEnabled()
    };
  }
}

export default new StaticAudioService();