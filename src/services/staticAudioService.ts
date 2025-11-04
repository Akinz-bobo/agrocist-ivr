import logger from "../utils/logger";
import cloudinaryService from "./cloudinaryService";
import localAudioService from "./localAudioService";
import config from "../config";
import { stripQueryParams } from "../utils/urlUtils";
// import Spitch from "spitch";
// import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";

// const elevenlabs = new ElevenLabsClient({
//   apiKey: process.env.ELEVENLABS_API_KEY,
// });

// const spitch = new Spitch({ apiKey: process.env.SPITCH_API_KEY });

export interface StaticAudioTexts {
  welcome: string;
  processing: string;
  analysisWait: string;
  error: string;
  goodbye: string;
  noRecording: string;
  wait: string;
  directRecording: string;
  followUpRecording: string;
  postAIMenu: string;
  noInputMessage: string;
  transfer: string;
  languageTimeout: string;
}

class StaticAudioService {
  private staticTexts: Record<string, StaticAudioTexts> = {
    en: {
      welcome:
        "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.",
      processing:
        "Thank you for your question. Agrocist is analyzing your concern.",
      analysisWait:
        "Please wait while we analyze your concern. This may take a few moments.",
      error:
        "I'm sorry, I didn't understand that. Let me take you back to the main menu.",
      goodbye: "Thank you for using Agrocist. Have a great day!",
      noRecording:
        "I didn't hear your recording. Please try again and speak after the beep.",
      wait: "Just a moment, processing your request.",
      directRecording:
        "You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
      followUpRecording: "What else can I help you with?",
      postAIMenu: "Press 1 for another question or press 0 to end the call.",
      noInputMessage:
        "We did not receive your selection. Let me repeat the options.",
      transfer:
        "Please hold while I connect you to one of our veterinary experts.",
      languageTimeout:
        "We did not receive your response. Let me repeat the options. Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.",
    },
    yo: {
      welcome:
        "Ẹ káàbọ̀ sí Agrocist, alábáṣepọ̀ òwe ẹranko tí ẹ lè gbẹ́kẹ̀lé. Ẹ tẹ́ ọ̀kan fún Gẹ̀ẹ́sì, méjì fún Yorùbá, mẹ́ta fún Hausa, tàbí mẹ́rin fún Igbo.",
      processing: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín.",
      analysisWait: "Ẹ dúró díẹ̀ kí a ṣe ìtúpalẹ̀ ìṣòro yín. Èyí lè gba àkókò díẹ̀.",
      error:
        "Má bínú, kò yé mi ohun tí ẹ sọ. Ẹ jẹ́ kí n gbé yín padà sí àtòjọ àkọ́kọ́.",
      goodbye: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      noRecording:
        "Mi ò gbọ́ ìgbóhùn yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si, kí ẹ sì sọ̀rọ̀ lẹ́yìn ìró àlámọ́.",
      wait: "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín.",
      directRecording:
        "Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      followUpRecording: "Kíni mìíràn tí mo lè ṣe fún yín?",
      postAIMenu:
        "Ẹ tẹ́ ọ̀kan fún ìbéèrè mìíràn tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      noInputMessage: "A kò gbọ́ àṣàyàn yín. Ẹ jẹ́ kí n tún àwọn àṣàyàn náà sọ.",
      transfer:
        "Ẹ dúró síbẹ̀ kí n so yín mọ́ ọ̀kan lára àwọn amọ̀ràn oníwòsàn ẹranko wa.",
      languageTimeout:
        "A kò gbọ́ ìdáhùn yín. Ẹ jẹ́ kí n tún àwọn àṣàyàn náà sọ. Ẹ tẹ́ ọ̀kan fún Gẹ̀ẹ́sì, méjì fún Yorùbá, mẹ́ta fún Hausa, tàbí mẹ́rin fún Igbo.",
    },
    ha: {
      welcome:
        "Maraba da zuwa Agrocist, abokin gona na kiwo da za ku iya dogara da shi. Danna 1 don Turanci, 2 don Yoruba, 3 don Hausa, ko 4 don Igbo.",
      processing: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku.",
      analysisWait: "Don Allah ku jira yayin da muke nazarin damuwar ku. Wannan na iya ɗaukar ɗan lokaci.",
      error:
        "Yi hakuri, ban fahimci hakan ba. Bari in mayar da ku zuwa babban menu.",
      goodbye: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
      noRecording:
        "Ban ji rikodin ku ba. Don Allah ku sake gwadawa kuma ku yi magana bayan sautin.",
      wait: "Don Allah ku ɗan jira, muna aiwatar da buƙatarku.",
      directRecording:
        "Kun zaɓi Hausa. Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
      followUpRecording: "Me kuma zan iya taimaka muku da shi?",
      postAIMenu: "Danna 1 don wata tambaya ko danna 0 don kammala kiran.",
      noInputMessage: "Ba mu karɓi zaɓin ku ba. Bari in sake maimaita zaɓukan.",
      transfer:
        "Don Allah ku jira yayin da nake haɗa ku da ɗaya daga cikin ƙwararrun likitocin dabbobinmu.",
      languageTimeout:
        "Ba mu karɓi amsar ku ba. Bari in sake maimaita zaɓukan. Danna 1 don Turanci, 2 don Yoruba, 3 don Hausa, ko 4 don Igbo.",
    },
    ig: {
      welcome:
        "Nnọọ na Agrocist, onye enyi gị n'ọrụ anụmanụ ị nwere ike ịdabere na ya. Pịa 1 maka Bekee, 2 maka Yoruba, 3 maka Hausa, ma ọ bụ 4 maka Igbo.",
      processing: "Daalụ maka ajụjụ gị. Agrocist na-enyocha nsogbu gị.",
      analysisWait: "Biko chere ka anyị nyochaa nsogbu gị. Nke a nwere ike were obere oge.",
      error:
        "Ewela iwe, aghọtaghị m ihe ị kwuru. Ka m laghachi gị na menu izizi.",
      goodbye: "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!",
      noRecording:
        "Anụghị m ndekọ gị. Biko gbalịa ọzọ ma kwuo okwu mgbe ụda ahụ gasịrị.",
      wait: "Chere ntakịrị, anyị na-edozi ihe ị chọrọ.",
      directRecording:
        "Ịhọrọla Igbo. Biko kọwaa nsogbu anụmanụ gị. Kwuo okwu n'ụzọ doro anya mgbe ụda ahụ (beep) gasịrị, wee pịa hash mgbe ị mechara.",
      followUpRecording: "Gịnị ọzọ ka m nwere ike inyere gị aka?",
      postAIMenu: "Pịa 1 maka ajụjụ ọzọ ma ọ bụ pịa 0 iji kwụsị oku a.",
      noInputMessage: "Anyị anatabeghị nhọrọ gị. Ka m kwughachi nhọrọ ndị ahụ.",
      transfer:
        "Biko chere ka m jikọọ gị na otu n'ime ndị ọkachamara veterinary anyị.",
      languageTimeout:
        "Anyị anatabeghị azịza gị. Ka m kwughachi nhọrọ ndị ahụ. Pịa 1 maka Bekee, 2 maka Yoruba, 3 maka Hausa, ma ọ bụ 4 maka Igbo.",
    },
  };

  private staticAudioUrls: Map<string, string> = new Map();

  /**
   * Pre-generate all static audio files at startup
   */
  async preGenerateStaticAudio(): Promise<void> {
    logger.info("🎵 Starting static audio pre-generation with DSN API...");
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    // Check DSN API configuration
    if (!config.dsn.username || !config.dsn.password) {
      logger.error(
        "❌ DSN API credentials not configured - static audio generation failed"
      );
      logger.info("🎵 Static audio pre-generation completed in 0ms");
      logger.info(
        `✅ Success: 0, ❌ Failed: 0, Total: 0 (failed due to missing DSN credentials)`
      );
      return;
    }

    const languages: Array<"en" | "yo" | "ha" | "ig"> = [
      "en",
      "yo",
      "ha",
      "ig",
    ];

    // Build list of all files to process
    const allFiles: Array<{ language: string; key: string; text: string }> = [];

    for (const language of languages) {
      const texts = this.staticTexts[language];

      if (!texts) {
        logger.error(`❌ No texts found for language: ${language}`);
        continue;
      }

      // Add each file to the processing queue
      for (const [key, text] of Object.entries(texts)) {
        allFiles.push({ language, key, text: text as string });
      }
    }

    logger.info(
      `🚀 Processing ${allFiles.length} static audio files sequentially...`
    );

    // Process files one by one to avoid overwhelming TTS API
    const results: PromiseSettledResult<void>[] = [];

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      if (!file) continue;

      logger.info(`📄 Processing file ${i + 1}/${allFiles.length}...`);

      try {
        await this.processStaticAudio(file.language, file.key, file.text);
        results.push({ status: "fulfilled", value: undefined });
      } catch (error) {
        results.push({ status: "rejected", reason: error });
      }

      // Add a delay between each file to prevent API rate limiting
      if (i + 1 < allFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay between files
      }
    }

    // Count results
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successCount++;
      } else {
        failedCount++;
        logger.error(`❌ Task ${index} failed:`, result.reason);
      }
    });

    const totalTime = Date.now() - startTime;
    logger.info(`🎵 Static audio pre-generation completed in ${totalTime}ms`);
    logger.info(
      `✅ Success: ${successCount}, ❌ Failed: ${failedCount}, Total: ${
        successCount + failedCount
      }`
    );
  }

  /**
   * Get pre-generated static audio URL
   */
  getStaticAudioUrl(
    language: "en" | "yo" | "ha" | "ig",
    textKey: keyof StaticAudioTexts
  ): string | null {
    const cacheKey = `${language}_${textKey}`;
    return this.staticAudioUrls.get(cacheKey) || null;
  }

  /**
   * Get static text for fallback
   */
  getStaticText(
    language: "en" | "yo" | "ha" | "ig",
    textKey: keyof StaticAudioTexts
  ): string {
    const languageTexts = this.staticTexts[language];
    const englishTexts = this.staticTexts.en;

    return languageTexts?.[textKey] || englishTexts?.[textKey] || "";
  }

  /**
   * Process a single static audio file (check existence + generate if needed)
   */
  private async processStaticAudio(
    language: string,
    key: string,
    text: string
  ): Promise<void> {
    const cacheKey = `${language}_${key}`;
    let finalUrl: string | null = null;

    // FASTEST PATH: Check if we already have this file URL cached in memory
    if (this.staticAudioUrls.has(cacheKey)) {
      finalUrl = this.staticAudioUrls.get(cacheKey)!;
      logger.info(`⚡ SKIPPED: Using cached static audio URL: ${cacheKey}`);
      return;
    }

    // FAST PATH: Check if file exists locally or on Cloudinary (only if not in memory cache)
    if (localAudioService.isEnabled()) {
      // Check local storage first
      const localUrl = `/audio/static/${language}_${key}.mp3`;
      if (localAudioService.fileExists(localUrl)) {
        finalUrl = `${config.webhook.baseUrl}${localUrl}`;
        logger.info(`♻️ SKIPPED: Using existing local static file: ${cacheKey}`);
      } else {
        // Generate and save using unified method
        logger.info(`📤 Generating new static audio: ${cacheKey}`);
        finalUrl = await this.uploadStaticToCloudinary(text, language, key);
        if (finalUrl) {
          logger.info(`✅ Saved new static audio: ${cacheKey}`);
        }
      }
    } else if (cloudinaryService.isEnabled()) {
      const basePublicId = cloudinaryService.generatePublicId(
        text,
        language,
        "static",
        key
      );
      const staticPublicId = `${config.cloudinary.folder}/static/${basePublicId}`;

      try {
        logger.info(
          `🔍 Checking for existing file on Cloudinary: ${staticPublicId}`
        );
        const existsOnCloudinary = await cloudinaryService.fileExists(
          staticPublicId
        );

        if (existsOnCloudinary) {
          // File already exists, use the existing URL (FAST PATH)
          const existingCloudinaryUrl =
            cloudinaryService.getOptimizedUrl(staticPublicId);
          if (existingCloudinaryUrl) {
            finalUrl = stripQueryParams(existingCloudinaryUrl);
            logger.info(
              `♻️ SKIPPED: Using existing static Cloudinary file: ${cacheKey} (${staticPublicId})`
            );
          }
        } else {
          // File doesn't exist, generate and upload it (SLOW PATH)
          logger.info(
            `📤 Generating new static audio: ${cacheKey} (will upload as ${staticPublicId})`
          );
          finalUrl = await this.uploadStaticToCloudinary(text, language, key);
          if (finalUrl) {
            logger.info(
              `✅ Uploaded new static audio to Cloudinary: ${cacheKey}`
            );
          }
        }
      } catch (error) {
        // If Cloudinary API is having issues, try to get URL directly first
        logger.warn(
          `Cloudinary API error for ${cacheKey}, trying direct URL:`,
          error
        );
        const directUrl = cloudinaryService.getOptimizedUrl(staticPublicId);
        if (directUrl) {
          finalUrl = stripQueryParams(directUrl);
          logger.info(
            `♻️ Using direct Cloudinary URL despite API error: ${cacheKey}`
          );
        } else {
          // Last resort: generate new file
          finalUrl = await this.uploadStaticToCloudinary(text, language, key);
          if (finalUrl) {
            logger.info(
              `✅ Generated static audio despite API issues: ${cacheKey}`
            );
          }
        }
      }
    } else {
      // Storage disabled, generate anyway
      finalUrl = await this.uploadStaticToCloudinary(text, language, key);
    }

    if (finalUrl) {
      this.staticAudioUrls.set(cacheKey, stripQueryParams(finalUrl));
      logger.debug(`✅ Generated ${cacheKey}: ${text.substring(0, 50)}...`);
    } else {
      logger.error(
        `❌ Failed to generate static audio for ${cacheKey} - static file not available`
      );
    }
  }

  /**
   * Upload static audio file using unified storage method
   */
  async uploadStaticToCloudinary(
    text: string,
    language: string,
    textKey: string
  ): Promise<string | null> {
    try {
      // Use centralized static publicId generation for consistency
      const publicId = cloudinaryService.generatePublicId(
        text,
        language,
        "static",
        textKey
      );

      console.log(
        `Uploading static audio to Cloudinary with publicId: ${publicId}`
      );

      // Generate TTS audio buffer directly (don't save to disk)
      let audioBuffer = await this.generateTTSBuffer(
        text,
        language as "en" | "yo" | "ha" | "ig"
      );
      if (!audioBuffer) {
        logger.warn(
          `Failed to generate TTS buffer for static audio: ${language}_${textKey}`
        );
        return null;
      }
      
      // Convert to 8kHz if ffmpeg is available
      const { AudioProcessor } = await import('../utils/audioProcessor');
      if (await AudioProcessor.isFFmpegAvailable()) {
        try {
          audioBuffer = await AudioProcessor.convertTo8kHz(audioBuffer);
          logger.info(`Converted static audio to 8kHz: ${audioBuffer.length} bytes`);
        } catch (error) {
          logger.warn(`Failed to convert static audio to 8kHz: ${error}`);
        }
      }

      // Use unified upload method (handles local first, then Cloudinary)
      const cloudinaryResult = await cloudinaryService.uploadAudioBuffer(
        audioBuffer,
        {
          publicId,
          folder: `${config.cloudinary.folder}/static`,
          type: 'static',
          language,
          textKey
        }
      );
      
      if (cloudinaryResult) {
        logger.info(`✅ Successfully saved static audio:`);
        logger.info(`   📄 File: ${language}_${textKey}`);
        logger.info(`   🌐 URL: ${cloudinaryResult.secureUrl}`);
        return cloudinaryResult.secureUrl;
      }


    } catch (error) {
      logger.warn(
        `Failed to upload static audio to Cloudinary: ${language}_${textKey}`,
        error
      );
    }

    return null;
  }

  /**
   * Generate TTS audio buffer without saving to disk
   * COMMENTED OUT - DSN API Implementation
   */
  private async generateTTSBuffer(
    text: string,
    language: "en" | "yo" | "ha" | "ig"
  ): Promise<Buffer | null> {
    // Debug: Log the exact text being passed to DSN API
    logger.warn(
      `🔍 DSN TTS Request - Language: ${language}, Text: "${text}" (length: ${
        text?.length || 0
      })`
    );

    if (!text || text.trim() === "") {
      logger.error(
        `❌ Empty text provided for DSN TTS: language=${language}, text="${text}"`
      );
      return null;
    }

    try {
      const axios = require("axios");
      const FormData = require("form-data");

      // Reuse TTS authentication and generation logic
      const ttsService = (await import("./ttsService")).default;
      const token = await ttsService.authenticateDSN();

      if (!token) {
        logger.warn("DSN API authentication failed");
        return null;
      } 

      // Voice configurations
      const voiceConfigs: Record<string, any> = {
        en: { voiceId: "lucy", language: "en" },
        yo: { voiceId: "sade", language: "yo" },
        ha: { voiceId: "zainab", language: "ha" },
        ig: { voiceId: "amara", language: "ig" },
      };

      const voiceConfig = voiceConfigs[language];
      if (!voiceConfig) {
        logger.warn(`No voice configuration found for language: ${language}`);
        return null;
      }

      // Create form data for the request
      const formData = new FormData();
      formData.append("text", text);
      formData.append("language", voiceConfig.language);
      formData.append("voice", voiceConfig.voiceId);
      formData.append("format", "mp3");

      // Make request to DSN TTS API with form-data
      const response = await axios({
        method: "POST",
        url: `${config.dsn.baseUrl}/api/v1/ai/spitch/text-to-speech`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      if (response) {
        // Avoid stringifying the full response (contains circular refs). Log a safe summary instead.
        try {
          const safeSummary = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            dataLength: response.data
              ? response.data.length || Buffer.byteLength(response.data || "")
              : 0,
          };
          logger.warn(`🔍 DSN TTS Response: ${JSON.stringify(safeSummary)}`);
        } catch (logError) {
          // Fallback - still avoid logging circular structures
          logger.warn(
            "🔍 DSN TTS Response received (unable to serialize details)"
          );
        }
      }

      const buffer = Buffer.from(response.data); // DEBUG: Log the first 4 bytes to check for magic numbers

      if (buffer && buffer.length > 4) {
        const magicBytes = buffer.toString("hex", 0, 4);
        logger.debug(`🔍 DSN TTS Buffer Magic Bytes: 0x${magicBytes}`); // Check for common signatures

        if (magicBytes.startsWith("494433")) {
          // "ID3"
          logger.debug("➡️  Buffer signature matches MP3 (ID3 tag).");
        } else if (magicBytes.startsWith("fffb")) {
          // "ÿû"
          logger.debug("➡️  Buffer signature matches MP3 (sync frame).");
        } else if (magicBytes.startsWith("52494646")) {
          // "RIFF"
          logger.warn("⚠️  WARNING: Buffer signature matches WAV!");
        } else {
          logger.debug("❔ Buffer format is unrecognized.");
        }
      }

      // Convert to 8kHz if ffmpeg is available
      const { AudioProcessor } = await import('../utils/audioProcessor');
      if (await AudioProcessor.isFFmpegAvailable()) {
        try {
          const convertedBuffer = await AudioProcessor.convertTo8kHz(buffer);
          logger.info(`Converted DSN buffer to 8kHz: ${convertedBuffer.length} bytes`);
          return convertedBuffer;
        } catch (error) {
          logger.warn(`Failed to convert DSN buffer to 8kHz: ${error}`);
        }
      }
      
      return buffer;
    } catch (error: any) {
      // Handle common timeout and connection errors concisely
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        logger.warn(`DSN API timeout for ${language} audio generation`);
      } else if (error.response?.status === 504) {
        logger.warn(`DSN API gateway timeout (504) for ${language} audio`);
      } else if (error.response?.status >= 500) {
        logger.warn(
          `DSN API server error (${error.response.status}) for ${language} audio`
        );
      } else {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        };
        logger.warn(`DSN TTS failed for ${language}:`, errorDetails);
      }
      return null;
    }
  }

  /**
   * Generate TTS audio buffer using Spitch API
   */
  // private async generateTTSBuffer(
  //   text: string,
  //   language: "en" | "yo" | "ha" | "ig"
  // ): Promise<Buffer | null> {
  //   logger.debug(
  //     `🔍 Spitch TTS Request - Language: ${language}, Text: "${text}" (length: ${
  //       text?.length || 0
  //     })`
  //   );

  //   if (!text || text.trim() === "") {
  //     logger.error(
  //       `❌ Empty text provided for Spitch TTS: language=${language}, text="${text}"`
  //     );
  //     return null;
  //   }

  //   try {
  //     // Voice configurations for different languages
  //     const voiceConfigs = {
  //       en: "lucy" as const,
  //       yo: "sade" as const,
  //       ha: "zainab" as const,
  //       ig: "amara" as const,
  //     };

  //     const voiceId = voiceConfigs[language];
  //     if (!voiceId) {
  //       logger.warn(`No voice configuration found for language: ${language}`);
  //       return null;
  //     }

  //     // Generate audio using Spitch SDK
  //     const res = await spitch.speech.generate({
  //       text: text,
  //       language: language,
  //       voice: voiceId,
  //       format: "wav",
  //     });

  //     const blob = await res.blob();
  //     const buffer = Buffer.from(await blob.arrayBuffer());

  //     if (buffer && buffer.length > 4) {
  //       const magicBytes = buffer.toString("hex", 0, 4);
  //       logger.debug(`🔍 Spitch TTS Buffer Magic Bytes: 0x${magicBytes}`);

  //       if (magicBytes.startsWith("52494646")) {
  //         // "RIFF"
  //         logger.debug("➡️  Buffer signature matches WAV.");
  //       } else if (magicBytes.startsWith("494433")) {
  //         // "ID3"
  //         logger.debug("➡️  Buffer signature matches MP3 (ID3 tag).");
  //       } else {
  //         logger.debug("❔ Buffer format is unrecognized.");
  //       }
  //     }

  //     logger.info(`✅ Spitch audio generated: ${buffer.length} bytes`);
  //     return buffer;
  //   } catch (error: any) {
  //     logger.error(`Spitch TTS failed for ${language}:`, {
  //       message: error.message,
  //       statusCode: error.statusCode,
  //       code: error.code,
  //     });

  //     if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
  //       logger.warn(`Spitch API timeout for ${language} audio generation`);
  //     } else if (error.statusCode === 401 || error.message?.includes("401")) {
  //       logger.error(`Spitch API authentication failed - check API key`);
  //     } else if (error.statusCode === 429 || error.message?.includes("429")) {
  //       logger.warn(`Spitch API rate limit exceeded for ${language}`);
  //     } else if (error.statusCode >= 500) {
  //       logger.warn(
  //         `Spitch API server error (${error.statusCode}) for ${language} audio`
  //       );
  //     }

  //     return null;
  //   }
  // }

  /**
   * COMMENTED OUT - ElevenLabs TTS Implementation
   */
  // private async generateTTSBufferElevenLabs(
  //   text: string,
  //   language: "en" | "yo" | "ha" | "ig"
  // ): Promise<Buffer | null> {
  //   logger.debug(
  //     `🔍 ElevenLabs TTS Request - Language: ${language}, Text: "${text}" (length: ${
  //       text?.length || 0
  //     })`
  //   );
  //
  //   if (!text || text.trim() === "") {
  //     logger.error(
  //       `❌ Empty text provided for ElevenLabs TTS: language=${language}, text="${text}"`
  //     );
  //     return null;
  //   }
  //
  //   try {
  //     // Voice configurations for different languages
  //     const voiceConfigs: Record<string, { voiceId: string }> = {
  //       en: {
  //         voiceId: process.env.ELEVENLABS_VOICE_ID_EN || "21m00Tcm4TlvDq8ikWAM",
  //       },
  //       yo: {
  //         voiceId: process.env.ELEVENLABS_VOICE_ID_YO || "21m00Tcm4TlvDq8ikWAM",
  //       },
  //       ha: {
  //         voiceId: process.env.ELEVENLABS_VOICE_ID_HA || "21m00Tcm4TlvDq8ikWAM",
  //       },
  //       ig: {
  //         voiceId: process.env.ELEVENLABS_VOICE_ID_IG || "21m00Tcm4TlvDq8ikWAM",
  //       },
  //     };
  //
  //     const voiceConfig = voiceConfigs[language];
  //     if (!voiceConfig) {
  //       logger.warn(`No voice configuration found for language: ${language}`);
  //       return null;
  //     }
  //
  //     // Generate audio using ElevenLabs SDK
  //     const audioStream = await elevenlabs.textToSpeech.convert(
  //       "V0PuVTP8lJVnkKNavZmc",
  //       {
  //         text,
  //         modelId: "eleven_multilingual_v2",
  //         outputFormat: "mp3_44100_128",
  //       }
  //     );
  //
  //     // Convert ReadableStream to Buffer for Cloudinary upload
  //     const chunks: Buffer[] = [];
  //     for await (const chunk of audioStream) {
  //       chunks.push(Buffer.from(chunk));
  //     }
  //     const buffer = Buffer.concat(chunks);
  //
  //     if (buffer && buffer.length > 4) {
  //       const magicBytes = buffer.toString("hex", 0, 4);
  //       logger.debug(`🔍 ElevenLabs TTS Buffer Magic Bytes: 0x${magicBytes}`);
  //
  //       if (magicBytes.startsWith("494433")) {
  //         logger.debug("➡️  Buffer signature matches MP3 (ID3 tag).");
  //       } else if (magicBytes.startsWith("fffb")) {
  //         logger.debug("➡️  Buffer signature matches MP3 (sync frame).");
  //       } else {
  //         logger.debug("❔ Buffer format is unrecognized.");
  //       }
  //     }
  //
  //     return buffer;
  //   } catch (error: any) {
  //     // Log detailed error information for debugging
  //     logger.error(`ElevenLabs TTS failed for ${language}:`, {
  //       message: error.message,
  //       statusCode: error.statusCode,
  //       code: error.code,
  //       cause: error.cause?.message || error.cause,
  //       stack: error.stack?.split("\n")[0],
  //     });
  //
  //     if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
  //       logger.warn(`ElevenLabs API timeout for ${language} audio generation`);
  //     } else if (error.statusCode === 401 || error.message?.includes("401")) {
  //       logger.error(`ElevenLabs API authentication failed - check API key`);
  //     } else if (error.statusCode === 429 || error.message?.includes("429")) {
  //       logger.warn(`ElevenLabs API rate limit exceeded for ${language}`);
  //     } else if (error.statusCode >= 500) {
  //       logger.warn(
  //         `ElevenLabs API server error (${error.statusCode}) for ${language} audio`
  //       );
  //     } else if (error.message?.includes("fetch failed")) {
  //       logger.error(
  //         `ElevenLabs API network error - check internet connection and API endpoint`
  //       );
  //     }
  //
  //     return null;
  //   }
  // }

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
      cloudinaryEnabled: cloudinaryService.isEnabled(),
    };
  }
}

export default new StaticAudioService();
