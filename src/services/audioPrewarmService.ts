import logger from '../utils/logger';
import ttsService, { TTSOptions } from './ttsService';

/**
 * Audio Pre-warming Service
 * Pre-generates frequently used audio prompts on startup for instant playback
 */
class AudioPrewarmService {
  private isWarmedUp: boolean = false;

  /**
   * Common prompts that should be pre-generated for all languages
   */
  private readonly commonPrompts = {
    en: [
      // CRITICAL: Main welcome message (plays on incoming call)
      "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, or 3 for Hausa.",
      // Recording prompts for each language
      "You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
      // Processing messages
      "Thank you for your question. Agrocist is analyzing your concern. Please wait a moment for your response.",
      "Just a moment, processing your request.",
      // Post-AI menu
      "Would you like to speak with a human veterinary expert? Press 1 to speak with an expert, or press 0 to end the call.",
      // Goodbye
      "Thank you for using Agrocist. Have a great day!",
      // Error messages
      "I'm sorry, I didn't understand that. Let me take you back to the main menu."
    ],
    yo: [
      "Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín. Ẹ dúró díẹ̀ fún ìdáhùn yín.",
      "Ṣé ẹ fẹ́ bá dokita oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      "Má bínú, kò yé mi ohun tí ẹ sọ. Ẹ jẹ́ kí n gbé yín padà sí àtòjọ àkọ́kọ́.",
      "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín."
    ],
    ha: [
      "Kun zaɓi Hausa. Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
      "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku. Don Allah ku jira na ɗan lokaci don amsar ku.",
      "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
      "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
      "Yi hakuri, ban fahimci hakan ba. Bari in mayar da ku zuwa babban menu.",
      "Don Allah ku ɗan jira, muna aiwatar da buƙatarku."
    ],
    ig: [
      "Ịhọrọla Igbo. Biko kọwaa nsogbu anụmanụ gị. Kwuo okwu n'ụzọ doro anya mgbe ụda ahụ (beep) gasịrị, wee pịa hash mgbe ị mechara.",
      "Daalụ maka ajụjụ gị. Agrocist na-enyocha nsogbu gị. Biko chere ntakịrị maka nzaghachi gị.",
      "Ị chọrọ ikwu okwu na ọkachamara veterinary mmadụ? Pịa 1 iji kwuo okwu na ọkachamara, ma ọ bụ pịa 0 iji kwụsị oku a.",
      "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!",
      "Ewela iwe, aghọtaghị m ihe ị kwuru. Ka m laghachi gị na menu izizi.",
      "Biko chere ntakịrị, anyị na-edozi ihe ị chọrọ."
    ]
  };

  /**
   * Pre-generate all common prompts for faster playback
   */
  async prewarmAudio(): Promise<void> {
    if (this.isWarmedUp) {
      logger.info('Audio already pre-warmed, skipping...');
      return;
    }

    logger.info('🔥 Starting audio pre-warming process...');
    const startTime = Date.now();

    const languages: Array<'en' | 'yo' | 'ha' | 'ig'> = ['en', 'yo', 'ha', 'ig'];
    let successCount = 0;
    let failCount = 0;

    // Generate all prompts in parallel for maximum speed
    const allPromises: Promise<void>[] = [];

    for (const language of languages) {
      const prompts = this.commonPrompts[language];
      for (const prompt of prompts) {
        const promise = this.generatePrompt(prompt, language)
          .then(() => {
            successCount++;
            logger.debug(`✅ Pre-warmed (${language}): ${prompt.substring(0, 50)}...`);
          })
          .catch((error) => {
            failCount++;
            logger.warn(`❌ Failed to pre-warm (${language}): ${prompt.substring(0, 50)}...`, error);
          });
        allPromises.push(promise);
      }
    }

    // Wait for all pre-warming to complete
    await Promise.allSettled(allPromises);

    const totalTime = Date.now() - startTime;
    this.isWarmedUp = true;

    logger.info(`🔥 Audio pre-warming completed in ${totalTime}ms`);
    logger.info(`✅ Success: ${successCount}, ❌ Failed: ${failCount}, Total: ${successCount + failCount}`);
  }

  /**
   * Generate a single prompt
   */
  private async generatePrompt(text: string, language: 'en' | 'yo' | 'ha' | 'ig'): Promise<void> {
    const options: TTSOptions = { language };
    await ttsService.generateSpeech(text, options);
  }

  /**
   * Check if audio has been pre-warmed
   */
  isPrewarmed(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Pre-warm specific prompt on-demand
   */
  async prewarmSpecific(text: string, language: 'en' | 'yo' | 'ha' | 'ig'): Promise<void> {
    try {
      await this.generatePrompt(text, language);
      logger.info(`🔥 On-demand pre-warm completed for (${language}): ${text.substring(0, 50)}...`);
    } catch (error) {
      logger.warn(`Failed to pre-warm on-demand (${language}): ${text.substring(0, 50)}...`, error);
    }
  }
}

export default new AudioPrewarmService();
