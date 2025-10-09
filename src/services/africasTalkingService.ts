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

    // Generate TTS audio for the main text using proper voice selection
    const audioUrl = await this.generateTTSAudio(text, language);
    response += audioUrl ? 
      `  <Play url="${audioUrl}"/>` : 
      `  <Say>${this.escapeXML(text)}</Say>`;

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
          `  <Play url="${endAudioUrl}"/>` : 
          `  <Say voice="${this.getVoiceForLanguage(language)}" playBeep="false">${this.escapeXML(endText)}</Say>`;
        // Just end with closing tag - AT will end call automatically
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
    const playTag = audioUrl ? 
      `<Play url="${audioUrl}"/>` : 
      `<Say>${this.escapeXML(prompt)}</Say>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    ${playTag}
  </Record>
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
    const playTag = audioUrl ? 
      `<Play url="${audioUrl}"/>` : 
      `<Say>${this.escapeXML(errorText)}</Say>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${playTag}
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
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
    const langCode = language as 'en' | 'yo' | 'ha';

    // According to Africa's Talking docs, prompt should be INSIDE the Record tag
    // This ensures the beep plays and recording starts properly
    const audioUrl = await this.generateTTSAudio(prompt, langCode);

    if (audioUrl) {
      // If we have TTS audio, use Play inside Record
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Play url="${audioUrl}"/>
  </Record>
</Response>`;
    } else {
      // Fallback to Say inside Record with proper voice
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
    }
  }

  async generateFollowUpRecordingResponse(language: string): Promise<string> {
    const prompts = {
      en: "Please ask your next question or describe another livestock concern. Speak clearly after the beep and press hash when done.",
      yo: "Ẹ béèrè ìbéèrè yín tókàn tàbí ẹ sọ ìṣòro ẹranko mìíràn. Ẹ sọ̀rọ̀ kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      ha: "Don Allah ku yi wata tambaya ko ku bayyana wata matsalar dabbobi. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const langCode = language as 'en' | 'yo' | 'ha';

    // Generate TTS audio for the follow-up prompt
    const audioUrl = await this.generateTTSAudio(prompt, langCode);

    if (audioUrl) {
      // If we have TTS audio, use Play inside Record
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Play url="${audioUrl}"/>
  </Record>
</Response>`;
    } else {
      // Fallback to Say inside Record with proper voice
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
    }
  }

  async generatePostAIMenuResponse(language: string): Promise<string> {
    const prompts = {
      en: "Do you have any other concerns? Press 1 to ask another question, press 2 to speak with a human expert, press 3 to go back to main menu, or press 0 to end the call.",
      yo: "Ṣé ẹ fẹ́ bá dokita oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const langCode = (language as 'en' | 'yo' | 'ha') || 'en';
    
    // Generate TTS audio with appropriate voice for the language
    const audioUrl = await this.generateTTSAudio(prompt, langCode);
    const playTag = audioUrl ? 
      `<Play url="${audioUrl}"/>` : 
      `<Say>${this.escapeXML(prompt)}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai">
    ${playTag}
  </GetDigits>
  ${playTag}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai</Redirect>
</Response>`;
  }

  // MAIN MENU
  private async getMainMenuXML(): Promise<string> {
    // Generate multi-language welcome message with appropriate voices
    const welcomeXML = await this.generateMultiLanguageWelcome();

    // Put audio INSIDE GetDigits with proper formatting
    return `<GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
${welcomeXML}
  </GetDigits>`;
  }

  /**
   * Generate multi-language welcome message with appropriate voices for each language
   * SIMPLIFIED: Use single Play tag to avoid Africa's Talking limitations
   */
  private async generateMultiLanguageWelcome(): Promise<string> {
    try {
      // Use simple, compatible text - no complex SSML
      const welcomeText = "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, or 3 for Hausa.";

      const audioUrl = await this.generateTTSAudio(welcomeText, 'en');

      if (audioUrl) {
        logger.info(`📢 Welcome audio URL: ${audioUrl}`);
        return `    <Play url="${audioUrl}"/>`;
      } else {
        logger.warn('⚠️ No audio URL for welcome, using simple Say tag');
        return `    <Say>${this.escapeXML(welcomeText)}</Say>`;
      }
    } catch (error) {
      logger.error('Error generating multi-language welcome:', error);
      // Fallback to simple English welcome
      const fallbackText = "Welcome to Agrocist. Press 1 for English, 2 for Yoruba, or 3 for Hausa.";
      return `    <Say>${this.escapeXML(fallbackText)}</Say>`;
    }
  }


  private async getRecordingXML(_language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    // Note: Prompt should be played BEFORE calling this method (not inside Record tag)
    // Using maxLength instead of timeout (Africa's Talking requirement)
    // maxLength: 30 seconds max recording duration
    // finishOnKey: # to end recording early
    // trimSilence: removes silence at end
    // playBeep: plays beep before recording starts
    return `<Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording"/>`;
  }

  private getImmediateRecordingXML(): string {
    return `<Record maxLength="30" trimSilence="true" playBeep="false" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say voice="woman">Please describe your livestock concern or question. Be as specific as possible about the animal type, symptoms, or issue you're experiencing.</Say>
  </Record>`;
  }

  private async getTransferXML(language: 'en' | 'yo' | 'ha' = 'en'): Promise<string> {
    const transferText = this.getLocalizedText('transfer', language);
    const audioUrl = await this.generateTTSAudio(transferText, language);
    const playTag = audioUrl ? 
      `<Play url="${audioUrl}"/>` : 
      `<Say voice="${this.getVoiceForLanguage(language)}" playBeep="false">${this.escapeXML(transferText)}</Say>`;
    
    return `${playTag}
  <Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>`;
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
      // Check if we should use Say only for testing
      if (config.testing.useSayOnly) {
        logger.info('Using Say only mode for testing - skipping TTS generation');
        return null; // Will use Say tag
      }

      // Force English only if testing flag is set
      const actualLanguage = config.testing.forceEnglishOnly ? 'en' : language;
      
      const options: TTSOptions = { language: actualLanguage };
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
   * Used for: goodbye, error, record_prompt, transfer messages
   * Note: Welcome message is handled separately in generateMultiLanguageWelcome()
   */
  /**
   * Get voice name for language according to Google TTS supported voices
   */
  private getVoiceForLanguage(language: 'en' | 'yo' | 'ha'): string {
    // Use simple 'woman' voice - more compatible with Africa's Talking
    return 'woman';
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getLocalizedText(key: string, language: 'en' | 'yo' | 'ha'): string {
    const texts: Record<string, Record<string, string>> = {
      goodbye: {
        en: "Thank you for using Agrocist. Have a great day!",
        yo: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
        ha: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!"
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
