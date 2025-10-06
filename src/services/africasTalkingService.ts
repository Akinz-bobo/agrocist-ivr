const AfricasTalking = require("africastalking");
import config from "../config";
import logger from "../utils/logger";
import ttsService, { TTSOptions } from "./ttsService";

class AfricasTalkingService {
  private client;
  private voice;
  private ttsAvailable: boolean = true;

  constructor() {
    this.client = AfricasTalking({
      apiKey: config.africasTalking.apiKey,
      username: config.africasTalking.username,
    });

    this.voice = this.client.VOICE;
  }

  async generateResponse(text: string, language: 'en' | 'yo' | 'ha' = 'en', nextAction?: string): Promise<string> {
    let response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

    // Generate TTS audio for the main text
    const audioUrl = await this.generateTTSAudio(text, language);
    response += audioUrl ? `  <Play url="${audioUrl}"/>` : `  <Say voice="woman">${text}</Say>`;

    switch (nextAction) {
      case "menu":
        response += await this.getMainMenuXML();
        break;
      case "record":
        response += await this.getRecordingXML(language);
        break;
      case "transfer":
        response += await this.getTransferXML(language);
        break;
      case "end":
        const endText = this.getLocalizedText('goodbye', language);
        const endAudioUrl = await this.generateTTSAudio(endText, language);
        response += endAudioUrl ? 
          `  <Play url="${endAudioUrl}"/>\n  <Hangup/>` : 
          `  <Say voice="woman">${endText}</Say>\n  <Hangup/>`;
        break;
      default:
        response += await this.getMainMenuXML();
    }

    response += `
</Response>`;

    return response;
  }

  async generateWelcomeResponse(): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getMainMenuXML()}
</Response>`;
  }

  async generateMenuResponse(menuType: string): Promise<string> {
    let menuXML = "";

    switch (menuType) {
      case "main":
      case "language":
        menuXML = await this.getMainMenuXML();
        break;
      default:
        menuXML = await this.getMainMenuXML();
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${menuXML}
</Response>`;
  }

  async generateRecordingResponse(prompt: string, language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    const audioUrl = await this.generateTTSAudio(prompt, language);
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${prompt}</Say>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playTag}
  ${await this.getRecordingXML(language)}
</Response>`;
  }

  generateImmediateRecordingResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${this.getImmediateRecordingXML()}
</Response>`;
  }

  async generateErrorResponse(language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    const errorText = this.getLocalizedText('error', language);
    const audioUrl = await this.generateTTSAudio(errorText, language);
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${errorText}</Say>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playTag}
  ${await this.getMainMenuXML()}
</Response>`;
  }

  async generateTransferResponse(language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getTransferXML(language)}
</Response>`;
  }

  async generateLanguageMenuResponse(): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getMainMenuXML()}
</Response>`;
  }

  async generateDirectRecordingResponse(language: string): Promise<string> {
    const prompts = {
      en: "You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
      yo: "Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      ha: "Kun zaɓi Hausa. Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const audioUrl = await this.generateTTSAudio(prompt, language as 'en' | 'yo' | 'ha');
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${prompt}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playTag}
  ${await this.getRecordingXML(language as 'en' | 'yo' | 'ha')}
</Response>`;
  }

  async generatePostAIMenuResponse(language: string): Promise<string> {
    const prompts = {
      en: "Would you like to speak with a human veterinary expert? Press 1 to speak with an expert, or press 0 to end the call.",
      yo: "Ṣé ẹ fẹ́ bá amọ̀ràn oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const langCode = (language as 'en' | 'yo' | 'ha') || 'en';
    
    // Generate TTS audio with appropriate voice for the language
    const audioUrl = await this.generateTTSAudio(prompt, langCode);
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${prompt}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playTag}
  <GetDigits timeout="8" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai">
    ${playTag}
  </GetDigits>
</Response>`;
  }

  // MAIN MENU
  private async getMainMenuXML(): Promise<string> {
    // Generate multi-language welcome message with appropriate voices
    const welcomeXML = await this.generateMultiLanguageWelcome();
    
    return `<GetDigits timeout="8" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
    ${welcomeXML}
  </GetDigits>`;
  }

  /**
   * Generate multi-language welcome message with appropriate voices for each language
   */
  private async generateMultiLanguageWelcome(): Promise<string> {
    try {
      // Base welcome message
      const baseWelcome = "Welcome to Agrocist, your trusted livestock farming partner.";
      const baseAudioUrl = await this.generateTTSAudio(baseWelcome, 'en');
      
      // English option
      const englishOption = "Press 1 for English.";
      const englishAudioUrl = await this.generateTTSAudio(englishOption, 'en');
      
      // Yoruba option - spoken in Yoruba voice
      const yorubaOption = "Fún Èdè Yorùbá, ẹ tẹ ẹ̀ẹ̀jì.";
      const yorubaAudioUrl = await this.generateTTSAudio(yorubaOption, 'yo');
      
      // Hausa option - spoken in Hausa voice
      const hausaOption = "Don Hausa, danna uku.";
      const hausaAudioUrl = await this.generateTTSAudio(hausaOption, 'ha');
      
      // Common options in English
      const commonOptions = "Press 4 to repeat this menu. Press 0 to end the call.";
      const commonAudioUrl = await this.generateTTSAudio(commonOptions, 'en');
      
      // Build XML with multiple play tags for different voices
      let xml = '';
      
      // Base welcome
      xml += baseAudioUrl ? `<Play url="${baseAudioUrl}"/>` : `<Say voice="woman">${baseWelcome}</Say>`;
      
      // English option
      xml += baseAudioUrl ? `<Play url="${englishAudioUrl}"/>` : `<Say voice="woman">${englishOption}</Say>`;
      
      // Yoruba option with Yoruba voice
      xml += yorubaAudioUrl ? `<Play url="${yorubaAudioUrl}"/>` : `<Say voice="woman">${yorubaOption}</Say>`;
      
      // Hausa option with Hausa voice
      xml += hausaAudioUrl ? `<Play url="${hausaAudioUrl}"/>` : `<Say voice="woman">${hausaOption}</Say>`;
      
      // Common options in English
      xml += commonAudioUrl ? `<Play url="${commonAudioUrl}"/>` : `<Say voice="woman">${commonOptions}</Say>`;
      
      return xml;
    } catch (error) {
      logger.error('Error generating multi-language welcome:', error);
      // Fallback to simple English welcome
      const fallbackText = "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, 3 for Hausa. Press 4 to repeat this menu. Press 0 to end the call.";
      return `<Say voice="woman">${fallbackText}</Say>`;
    }
  }


  private async getRecordingXML(language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    const recordPrompt = this.getLocalizedText('record_prompt', language);
    const audioUrl = await this.generateTTSAudio(recordPrompt, language);
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${recordPrompt}</Say>`;
    
    return `<Record timeout="10" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    ${playTag}
  </Record>`;
  }

  private getImmediateRecordingXML(): string {
    return `<Record timeout="10" trimSilence="true" playBeep="false" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say voice="woman">Please describe your livestock concern or question. Be as specific as possible about the animal type, symptoms, or issue you're experiencing.</Say>
  </Record>`;
  }

  private async getTransferXML(language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    const transferText = this.getLocalizedText('transfer', language);
    const audioUrl = await this.generateTTSAudio(transferText, language);
    const playTag = audioUrl ? `<Play url="${audioUrl}"/>` : `<Say voice="woman">${transferText}</Say>`;
    
    return `<Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer">
    ${playTag}
  </Dial>`;
  }

  async makeCall(phoneNumber: string): Promise<boolean> {
    try {
      const callData = {
        to: phoneNumber,
        from: config.africasTalking.shortCode,
      };

      const result = await this.voice.call(callData);
      logger.info(`Call initiated to ${phoneNumber}:`, result);
      return true;
    } catch (error) {
      logger.error(`Error making call to ${phoneNumber}:`, error);
      return false;
    }
  }

  async uploadMedia(mediaUrl: string): Promise<string | null> {
    try {
      const result = await this.voice.uploadMediaFile(mediaUrl);
      logger.info("Media uploaded:", result);
      return result.mediaId;
    } catch (error) {
      logger.error("Error uploading media:", error);
      return null;
    }
  }

  isValidDTMF(dtmf: string): boolean {
    return /^[0-9*#]+$/.test(dtmf);
  }

  extractMenuChoice(dtmf: string): number | string {
    if (!dtmf) return 0;

    if (dtmf === "*") return "repeat";
    if (dtmf === "#") return "finish";

    const choice = parseInt(dtmf.charAt(0));
    return isNaN(choice) ? 0 : choice;
  }

  /**
   * Check if TTS is currently available
   */
  isTTSAvailable(): boolean {
    return this.ttsAvailable;
  }

  /**
   * Generate TTS audio for text in specified language
   */
  async generateTTSAudio(text: string, language: 'en' | 'yo' | 'ha'): Promise<string | null> {
    try {
      const options: TTSOptions = { language };
      const result = await ttsService.generateSpeech(text, options);
      // TTS succeeded, mark as available
      this.ttsAvailable = true;
      return result;
    } catch (error) {
      logger.error(`Failed to generate TTS for language ${language}:`, error);
      // TTS failed, mark as unavailable
      this.ttsAvailable = false;
      return null; // Fallback to Say tag
    }
  }

  /**
   * Get localized text for common phrases
   */
  private getLocalizedText(key: string, language: 'en' | 'yo' | 'ha'): string {
    const texts: Record<string, Record<string, string>> = {
      welcome: {
        en: this.ttsAvailable 
          ? "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English. Fún Èdè Yorùbá, ẹ tẹ ẹ̀ẹ̀jì. Don Hausa, danna uku. Press 4 to repeat this menu. Press 0 to end the call."
          : "Welcome to Agrocist, your trusted livestock farming partner. This service is currently available in English only. Press 1 to continue in English, or press 0 to end the call.",
        yo: this.ttsAvailable 
          ? "Ẹ kú àbọ̀ sí Agrocist, alábáṣe àgbẹ̀ ẹran tí ẹ lè gbẹ́kẹ̀lé. Fún Èdè Gẹ̀ẹ́sì, ẹ tẹ ọ̀kan. Fún Èdè Yorùbá, ẹ tẹ ẹ̀ẹ̀jì. Fún Èdè Hausa, ẹ tẹ ẹ̀ta. Ẹ tẹ ẹ̀rin láti tún gbọ́ àtòjọ yìí. Ẹ tẹ ọ̀fà láti parí ìpè náà."
          : "Welcome to Agrocist, your trusted livestock farming partner. This service is currently available in English only. Press 1 to continue in English, or press 0 to end the call.",
        ha: this.ttsAvailable 
          ? "Barka da zuwa Agrocist, abokin noman dabbobi da kuke dogara gare shi. Danna ɗaya don Turanci. Don Yoruba, danna biyu. Don Hausa, danna uku. Danna huɗu don maimaita wannan menu. Danna sifili don kammala kiran."
          : "Welcome to Agrocist, your trusted livestock farming partner. This service is currently available in English only. Press 1 to continue in English, or press 0 to end the call."
      },
      goodbye: {
        en: "Thank you for calling Agrocist. Have a great day!",
        yo: "A dúpẹ́ fún ìpè sí Agrocist. Ẹ ní ọjọ́ tí ó dára!",
        ha: "Na gode da kiran Agrocist. Ku yi kyakkyawan rana!"
      },
      error: {
        en: "I'm sorry, I didn't understand that. Let me take you back to the main menu.",
        yo: "Má bínú, kò yé mi ohun tí ẹ sọ. Ẹ jẹ́ kí n gbé yín padà sí àtòjọ àkọ́kọ́.",
        ha: "Yi hakuri, ban fahimci hakan ba. Bari in mayar da ku zuwa babban menu."
      },
      record_prompt: {
        en: "Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
        yo: "Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
        ha: "Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama."
      },
      agent_option: {
        en: "Would you like to speak with a human veterinary expert? Press 1 to speak with an expert, or press 0 to end the call.",
        yo: "Ṣé ẹ fẹ́ bá amọ̀ràn oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
        ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran."
      },
      transfer: {
        en: "Please hold while I connect you to one of our veterinary experts.",
        yo: "Ẹ dúró síbẹ̀ kí n so yín mọ́ ọ̀kan lára àwọn amọ̀ràn oníwòsàn ẹranko wa.",
        ha: "Don Allah ku jira yayin da nake haɗa ku da ɗaya daga cikin ƙwararrun likitocin dabbobinmu."
      }
    };

    return texts[key]?.[language] || texts[key]?.['en'] || '';
  }
}

export default new AfricasTalkingService();
