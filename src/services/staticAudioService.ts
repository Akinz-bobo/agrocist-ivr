import logger from "../utils/logger";
import cloudinaryService from "./cloudinaryService";
import localAudioService from "./localAudioService";
import config from "../config";
import { stripQueryParams } from "../utils/urlUtils";
import Spitch from "spitch";

// Keys for all pre-generated static audio clips
export type StaticAudioKey =
  | "welcome" // Full greeting + gate options (first time caller hears)
  | "gateOptions" // Just the options: "Press 1 for AI, press 2 for human agent" (used on retry)
  | "premiumRequired" // Message for non-premium users trying to access human agents
  | "languageMenu" // Clean language selection prompt: "Press 1 for English, 2 for Yoruba..."
  | "processing"
  | "analysisWait"
  | "error"
  | "goodbye"
  | "noRecording"
  | "wait"
  | "directRecording"
  | "followUpRecording"
  | "postAIMenu"
  | "noInputMessage"
  | "transfer"
  | "languageTimeout";

// Spitch voice names per language
const VOICE_MAP: Record<string, string> = {
  en: "john",
  ha: "amina",
  ig: "amara",
  yo: "sade",
};

// All static prompt texts per language.
// These are pre-generated at startup and served as audio files during calls.
const STATIC_TEXTS: Record<string, Record<StaticAudioKey, string>> = {
  en: {
    // Gate menu — the very first thing a caller hears (greeting + options)
    welcome:
      "Welcome to Agrocist, your trusted livestock farming partner. Press 1 to speak with our AI veterinary assistant, or press 2 to speak with a human agent.",
    // Repeat prompt — options only, no greeting
    gateOptions:
      "Press 1 to speak with our AI veterinary assistant, or press 2 to speak with a human agent.",
    // Language selection — clean prompt with no "we did not receive" prefix
    languageMenu:
      "Please select your language. Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.",
    // Played when a non-premium user tries to reach a human agent
    premiumRequired:
      "Speaking with a human agent is a premium feature. Please subscribe to Agrocist Premium to access this service. Thank you for calling.",
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
    postAIMenu: "Press 1 for another question, or press 0 to end the call.",
    noInputMessage:
      "We did not receive your selection. Let me repeat the options.",
    transfer:
      "Please hold while I connect you to one of our veterinary experts.",
    languageTimeout:
      "We did not receive your response. Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.",
  },

  yo: {
    welcome: "",
    gateOptions: "",
    languageMenu: "",
    premiumRequired:
      "Sísọ̀rọ̀ pẹ̀lú aṣojú ènìyàn jẹ́ ẹ̀yà àwọn tó sanwó. Ẹ jọ̀wọ́ ẹ forúkọ sílẹ̀ fún Agrocist Premium láti lo iṣẹ́ yìí. A dúpẹ́ fún ìpè yín.",
    processing: "O ṣeun fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìbéèrè yín.",
    analysisWait:
      "Ẹ jọ̀ọ́, ẹ dúró díẹ̀ kí a lè ṣe ìtúpalẹ̀ ìbéèrè yín. Ó lè gba ìsẹ́jú díẹ̀.",
    error:
      "Ẹ má bínú, ohun tí ẹ sọ kò ye mí. Ẹ jẹ́ kí n gbe yín padà sí ipele àkọ́kọ́.",
    goodbye: "O ṣeun fún lílo Agrocist. Ẹ ní ọjọ́ àlàáfíà!",
    noRecording:
      "Mi ò gbọ́ ohun tí ẹ wí. Ẹ jọ̀ọ́, kí ẹ gbìyànjú lẹ́ẹ̀kansi lẹ́yìn tí ẹ bá gbọ́ agogo náà.",
    wait: "Ẹ jọ̀ọ́, ẹ dúró díẹ̀, a ń ṣe ìmúlòlùfẹ́ ìbéèrè yín.",
    directRecording:
      "Ẹ ti yan èdè Yorùbá. Ẹ ṣàpèjúwe ìbéèrè ẹran-ọ̀sìn yín. Ẹ sọ kedere lẹ́yìn tí ẹ gbọ́ agogo náà. Kí ẹ sì tẹ haasi nígbà tí ẹ bá parí.",
    followUpRecording: "Kí ni míì tí ẹ fẹ́ kí n ran yín lọ́wọ́?",
    postAIMenu: "Tẹ ookan fún ìbéèrè míì, tàbí tẹ oodo láti parí ìpè.",
    noInputMessage: "A kò gba yíyan kankan. Ẹ jẹ́ kí n tún àwọn àṣàyàn náà sọ.",
    transfer: "Ẹ jọ̀ọ́, ẹ dúró díẹ̀ kí n bá yín so pọ̀ mọ́ amòfin ẹranko wa.",
    languageTimeout:
      "Ẹ ò tẹ́ nkankan, tẹ́ ookan fún Gẹ̀ẹ́sì, eeji fún Yorùbá, eeta fún Hausa, tàbí eerin fún Ìgbò.",
  },

  ha: {
    welcome: "",
    gateOptions: "",
    languageMenu: "",
    premiumRequired:
      "Magana da wakilin ɗan adam fasali ne na premium. Don Allah ku yi rajista don Agrocist Premium don samun wannan sabis. Mun gode da kiran ku.",
    processing: "Mun gode da tambayarka. Agrocist yana nazarin tambayar ka.",
    analysisWait:
      "Da fatan za ka jira yayin da muke nazarin tambayar ka. Wannan zai iya ɗaukar ɗan lokaci kaɗan.",
    error:
      "Yi haƙuri, ban fahimci abin da ka faɗa ba. Zan mayar da kai zuwa babban menu.",
    goodbye: "Mun gode da amfani da Agrocist. Yi rana mai kyau!",
    noRecording:
      "Ban ji abin da kuka faɗa ba. Da fatan za ku sake gwadawa bayan karar beep.",
    wait: "Da fatan ka jira, muna sarrafa buƙatarka.",
    directRecording:
      "Ka zaɓi Hausa. Don Allah ka bayyana tambayar da ta shafi dabbobinka. Ka yi magana a sarari bayan beep sannan ka danna hash idan ka gama.",
    followUpRecording: "Me zan taimaka maka da shi kuma?",
    postAIMenu: "Latsa daya don wani tambaya, ko sifili don rufe kiran.",
    noInputMessage: "Ba mu samu zabinka ba. Zan maimaita zaɓuɓɓukan.",
    transfer:
      "Da fatan ka jira yayin da nake haɗa ka da kwararren likitan dabbobi.",
    languageTimeout:
      "Ba ku danna komai ba, latsa daya don Turanci, biyu don Yoruba, uku don Hausa, ko hudu don Igbo.",
  },

  ig: {
    welcome: "",
    gateOptions: "",
    languageMenu: "",
    premiumRequired:
      "Ikwu okwu na onye nnọchiteanya mmadụ bụ ihe nke ndị nwere premium. Biko debanye aha maka Agrocist Premium iji nweta ọrụ a. Daalụ maka oku gị.",
    processing: "Daalụ maka ajụjụ gị. Agrocist na-enyocha ajụjụ ị jụrụ.",
    analysisWait:
      "Biko chere obere ka anyị nyochaa ajụjụ gị. Nke a nwere ike were obere oge.",
    error:
      "Biko, echeghị m ihe i kwuru nke ọma. Ka m weghachite gị na isi menu.",
    goodbye: "Daalụ maka iji Agrocist. Ka ụbọchi gị bụrụ nke ọma!",
    noRecording: "Anụghị m ihe ị kwuru. Biko gbalịa ọzọ mgbe ụda beep gasịrị.",
    wait: "Biko chere ntakịrị ka anyị na-emekọ ihe i rịọrọ.",
    directRecording:
      "Ị họrọla Igbo. Biko kọwaa ajụjụ gbasara anụmanụ gị. Kwuo nke ọma mgbe beep gasịrị ma pịa hash mgbe ị gwụchara.",
    followUpRecording: "Kedu ihe ọzọ ka m nwere ike inyere gị?",
    postAIMenu: "Pịa otu maka ajụjụ ọzọ, ma ọ bụ pịa efu ka ị kwụsị oku.",
    noInputMessage: "Anyị enwetaghị nhọrọ gị. Ka m kwughachi nhọrọ ndị ahụ.",
    transfer: "Biko chere ka m jikọọ gị na ọkachamara anụmanụ.",
    languageTimeout:
      "Ị nweghị pịa ihe ọ bụla, pịa otu maka Bekee, abụọ maka Yoruba, atọ maka Hausa, ma ọ bụ anọ maka Igbo.",
  },
};

class StaticAudioService {
  private client: Spitch;

  // In-memory cache: "language_key" → hosted audio URL
  private audioUrlCache: Map<string, string> = new Map();

  constructor() {
    this.client = new Spitch({ apiKey: config.spitch.apiKey });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Pre-generate all static audio files at startup.
   * Files are checked against Cloudinary/local storage first to avoid
   * regenerating audio that already exists.
   */
  async preGenerateStaticAudio(): Promise<void> {
    if (!config.spitch.apiKey) {
      logger.error(
        "Spitch API key not configured — static audio generation skipped",
      );
      return;
    }

    logger.info("🎵 Starting static audio pre-generation...");
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;

    const languages = ["en", "yo", "ha", "ig"] as const;

    // Build a flat list of all (language, key, text) entries to process
    const tasks: Array<{ language: string; key: string; text: string }> = [];
    for (const language of languages) {
      const texts = STATIC_TEXTS[language];
      if (!texts) continue;
      for (const [key, text] of Object.entries(texts) as [string, string][]) {
        // Skip entries with empty text (e.g. non-English welcome messages)
        if (text) tasks.push({ language, key, text });
      }
    }

    logger.info(
      `Processing ${tasks.length} static audio files sequentially...`,
    );

    // Process one at a time to avoid overwhelming the TTS API
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!;
      try {
        await this.processStaticAudio(task.language, task.key, task.text);
        successCount++;
      } catch (error) {
        failedCount++;
        logger.error(`Failed to generate ${task.language}_${task.key}:`, error);
      }

      // Small delay between requests to respect API rate limits
      if (i + 1 < tasks.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(
      `🎵 Static audio pre-generation done in ${elapsed}ms — ✅ ${successCount} succeeded, ❌ ${failedCount} failed`,
    );
  }

  /**
   * Return the pre-generated audio URL for a given language + key, or null if not ready.
   * Hard-coded overrides are used for files that were manually uploaded to Cloudinary
   * and need to bypass the normal public ID lookup.
   */
  getStaticAudioUrl(
    language: "en" | "yo" | "ha" | "ig",
    key: StaticAudioKey,
  ): string | null {
    // The English post-AI menu was manually uploaded with a custom filename
    if (language === "en" && key === "postAIMenu") {
      return "https://res.cloudinary.com/dk9oamdmg/video/upload/v1/agrocist-ivr/audio/static/postAIMenu_en_new_changed.mp3";
    }

    return this.audioUrlCache.get(`${language}_${key}`) ?? null;
  }

  /**
   * Return the raw text for a given language + key.
   * Used as a fallback when audio is not available.
   */
  getStaticText(
    language: "en" | "yo" | "ha" | "ig",
    key: StaticAudioKey,
  ): string {
    return STATIC_TEXTS[language]?.[key] ?? STATIC_TEXTS["en"]?.[key] ?? "";
  }

  /** Return cache statistics (useful for health checks). */
  getCacheStats(): {
    size: number;
    keys: string[];
    cloudinaryEnabled: boolean;
  } {
    return {
      size: this.audioUrlCache.size,
      keys: Array.from(this.audioUrlCache.keys()),
      cloudinaryEnabled: cloudinaryService.isEnabled(),
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Ensure a single static audio file is available and cached.
   * Order of preference:
   *   1. Already in memory cache → skip
   *   2. Exists on local filesystem → use existing URL
   *   3. Exists on Cloudinary → use existing URL
   *   4. Generate via Spitch and upload
   */
  private async processStaticAudio(
    language: string,
    key: string,
    text: string,
  ): Promise<void> {
    const cacheKey = `${language}_${key}`;

    // 1. Already cached in memory
    if (this.audioUrlCache.has(cacheKey)) {
      logger.info(`⚡ Cached: ${cacheKey}`);
      return;
    }

    let finalUrl: string | null = null;

    if (localAudioService.isEnabled()) {
      // 2. Check local filesystem
      const localPath = `/audio/static/${language}_${key}.mp3`;
      if (localAudioService.fileExists(localPath)) {
        finalUrl = `${config.webhook.baseUrl}${localPath}`;
        logger.info(`♻️ Using existing local file: ${cacheKey}`);
      } else {
        finalUrl = await this.generateAndUpload(text, language, key);
      }
    } else if (cloudinaryService.isEnabled()) {
      // 3. Check Cloudinary
      const publicId = cloudinaryService.generatePublicId(
        text,
        language,
        "static",
        key,
      );
      const fullPublicId = `${config.cloudinary.folder}/static/${publicId}`;

      try {
        if (await cloudinaryService.fileExists(fullPublicId)) {
          const url = cloudinaryService.getOptimizedUrl(fullPublicId);
          if (url) {
            finalUrl = stripQueryParams(url);
            logger.info(`♻️ Using existing Cloudinary file: ${cacheKey}`);
          }
        }
      } catch (error) {
        // Cloudinary API error — try direct URL before regenerating
        logger.warn(
          `Cloudinary API error for ${cacheKey}, trying direct URL:`,
          error,
        );
        const directUrl = cloudinaryService.getOptimizedUrl(fullPublicId);
        if (directUrl) {
          finalUrl = stripQueryParams(directUrl);
        }
      }

      // 4. Generate if still not found
      if (!finalUrl) {
        finalUrl = await this.generateAndUpload(text, language, key);
      }
    } else {
      // No storage configured — generate anyway (will return base64 or fail)
      finalUrl = await this.generateAndUpload(text, language, key);
    }

    if (finalUrl) {
      this.audioUrlCache.set(cacheKey, stripQueryParams(finalUrl));
      logger.debug(`✅ Cached ${cacheKey}: ${text.substring(0, 50)}...`);
    } else {
      logger.error(`❌ Failed to generate static audio: ${cacheKey}`);
    }
  }

  /**
   * Generate TTS audio via Spitch and upload to storage.
   * Returns the hosted URL, or null on failure.
   */
  async generateAndUpload(
    text: string,
    language: string,
    textKey: string,
  ): Promise<string | null> {
    try {
      const audioBuffer = await this.generateTTSBuffer(
        text,
        language as "en" | "yo" | "ha" | "ig",
      );
      if (!audioBuffer) return null;

      const publicId = cloudinaryService.generatePublicId(
        text,
        language,
        "static",
        textKey,
      );

      const result = await cloudinaryService.uploadAudioBuffer(audioBuffer, {
        publicId,
        folder: `${config.cloudinary.folder}/static`,
        type: "static",
        language,
        textKey,
      });

      if (result?.secureUrl) {
        logger.info(
          `✅ Uploaded static audio: ${language}_${textKey} → ${result.secureUrl}`,
        );
        return result.secureUrl;
      }
    } catch (error) {
      logger.warn(
        `Failed to upload static audio: ${language}_${textKey}`,
        error,
      );
    }

    return null;
  }

  /**
   * Call the Spitch API and return the raw MP3 buffer.
   */
  private async generateTTSBuffer(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
  ): Promise<Buffer | null> {
    if (!text?.trim()) {
      logger.error(`Empty text for Spitch TTS: language=${language}`);
      return null;
    }

    try {
      const voice = VOICE_MAP[language] ?? "john";
      const response = await this.client.speech.generate({
        text,
        language,
        voice: voice as any,
        format: "mp3",
        model: "legacy",
      });

      const blob = await response.blob();
      const buffer = Buffer.from(await blob.arrayBuffer());
      logger.info(`✅ Spitch generated ${buffer.length} bytes for ${language}`);
      return buffer;
    } catch (error: any) {
      logger.error(`Spitch TTS failed for ${language}:`, {
        message: error.message,
        statusCode: error.statusCode,
      });
      return null;
    }
  }
}

export default new StaticAudioService();
