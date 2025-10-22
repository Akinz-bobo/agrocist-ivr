const AfricasTalking = require("africastalking");
import config from "../config";
import logger from "../utils/logger";
import ttsService, { TTSOptions } from "./ttsService";
import staticAudioService from "./staticAudioService";

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

  async generateResponse(text: string, language: 'en' | 'yo' | 'ha' | 'ig' = 'en', nextAction?: string): Promise<string> {
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
        const endAudioUrl = staticAudioService.getStaticAudioUrl(language, 'goodbye');
        if (endAudioUrl) {
          response += `  <Play url="${endAudioUrl}"/>`;
        } else {
          const endText = staticAudioService.getStaticText(language, 'goodbye');
          response += `  <Say voice="${this.getVoiceForLanguage(language)}" playBeep="false">${this.escapeXML(endText)}</Say>`;
        }
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

  async generateRecordingResponse(prompt: string, language: 'en' | 'yo' | 'ha' | 'ig' = 'en'): Promise<string> {
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

  async generateErrorResponse(language: 'en' | 'yo' | 'ha' | 'ig' = 'en'): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, 'error');
    
    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="${audioUrl}"/>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
    }

    // Fallback to text if static audio not available
    const errorText = staticAudioService.getStaticText(language, 'error');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${this.escapeXML(errorText)}</Say>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
  }

  async generateTransferResponse(language: 'en' | 'yo' | 'ha' | 'ig' = 'en'): Promise<string> {
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
    const audioUrl = staticAudioService.getStaticAudioUrl(language as 'en' | 'yo' | 'ha' | 'ig', 'directRecording');
    
    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Play url="${audioUrl}"/>
  </Record>
</Response>`;
    }

    // Fallback to text if static audio not available
    const prompt = staticAudioService.getStaticText(language as 'en' | 'yo' | 'ha' | 'ig', 'directRecording');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
  }

  async generateFollowUpRecordingResponse(language: string): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language as 'en' | 'yo' | 'ha' | 'ig', 'followUpRecording');
    
    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Play url="${audioUrl}"/>
  </Record>
</Response>`;
    }

    // Fallback to text if static audio not available
    const prompt = staticAudioService.getStaticText(language as 'en' | 'yo' | 'ha' | 'ig', 'followUpRecording');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
  }

  async generatePostAIMenuResponse(language: string): Promise<string> {
    const prompts = {
      en: "Press 1 for another question or press 0 to end the call.",
      yo: "Ṣé ẹ fẹ́ bá dokita oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
      ig: "Ị nwere nsogbu ndị ọzọ? Pịa 1 iji jụọ ajụjụ ọzọ, pịa 2 iji kwuo okwu na ọkachamara mmadụ, pịa 3 iji laghachi na menu izizi, ma ọ bụ pịa 0 iji kwụsị oku a.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const langCode = (language as 'en' | 'yo' | 'ha' | 'ig') || 'en';
    
    // Try to use static audio for post-AI menu
    const audioUrl = staticAudioService.getStaticAudioUrl(langCode, 'postAIMenu');
    let playTag: string;
    
    if (audioUrl) {
      playTag = `<Play url="${audioUrl}"/>`;
    } else {
      // Fallback to static text if audio not available
      const staticPrompt = staticAudioService.getStaticText(langCode, 'postAIMenu');
      playTag = `<Say>${this.escapeXML(staticPrompt)}</Say>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="2" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai">
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

    // Put audio INSIDE GetDigits with proper formatting, add Redirect for timeout handling
    return `<GetDigits timeout="2" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
${welcomeXML}
  </GetDigits>
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>`;
  }

  /**
   * Generate multi-language welcome message using pre-generated static audio
   */
  private async generateMultiLanguageWelcome(): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl('en', 'welcome');

    if (audioUrl) {
      logger.info(`📢 Welcome audio URL (static): ${audioUrl}`);
      return `    <Play url="${audioUrl}"/>`;
    }

    // Fallback to text if static audio not available
    const welcomeText = staticAudioService.getStaticText('en', 'welcome');
    return `    <Say>${this.escapeXML(welcomeText)}</Say>`;
  }


  private async getRecordingXML(_language: 'en' | 'yo' | 'ha' | 'ig' = 'en'): Promise<string> {
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

  private async getTransferXML(language: 'en' | 'yo' | 'ha' | 'ig' = 'en'): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, 'transfer');
    
    if (audioUrl) {
      return `<Play url="${audioUrl}"/>
  <Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>`;
    }

    // Fallback to text if static audio not available
    const transferText = staticAudioService.getStaticText(language, 'transfer');
    return `<Say voice="${this.getVoiceForLanguage(language)}" playBeep="false">${this.escapeXML(transferText)}</Say>
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
  async generateTTSAudio(text: string, language: 'en' | 'yo' | 'ha' | 'ig', phoneNumber: string = 'unknown'): Promise<string | null> {
    try {
      // Check if we should use Say only for testing
      if (config.testing.useSayOnly) {
        logger.info('Using Say only mode for testing - skipping TTS generation');
        return null; // Will use Say tag
      }

      // Force English only if testing flag is set
      const actualLanguage = config.testing.forceEnglishOnly ? 'en' : language;

      const result = await ttsService.generateAIAudio(text, actualLanguage, phoneNumber);
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
  private getVoiceForLanguage(language: 'en' | 'yo' | 'ha' | 'ig'): string {
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

  private getLocalizedText(key: string, language: 'en' | 'yo' | 'ha' | 'ig'): string {
    const texts: Record<string, Record<string, string>> = {
      goodbye: {
        en: "Thank you for using Agrocist. Have a great day!",
        yo: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
        ha: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
        ig: "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!"
      },
      error: {
        en: "I'm sorry, I didn't understand that. Let me take you back to the main menu.",
        yo: "Má bínú, kò yé mi ohun tí ẹ sọ. Ẹ jẹ́ kí n gbé yín padà sí àtòjọ àkọ́kọ́.",
        ha: "Yi hakuri, ban fahimci hakan ba. Bari in mayar da ku zuwa babban menu.",
        ig: "Ewela iwe, aghọtaghị m ihe ị kwuru. Ka m laghachi gị na menu izizi."
      },
      record_prompt: {
        en: "Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
        yo: "Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
        ha: "Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
        ig: "Biko kọwaa nsogbu anụmanụ gị. Kwuo okwu n'ụzọ doro anya mgbe ụda ahụ (beep) gasịrị, wee pịa hash mgbe ị mechara."
      },
      transfer: {
        en: "Please hold while I connect you to one of our veterinary experts.",
        yo: "Ẹ dúró síbẹ̀ kí n so yín mọ́ ọ̀kan lára àwọn amọ̀ràn oníwòsàn ẹranko wa.",
        ha: "Don Allah ku jira yayin da nake haɗa ku da ɗaya daga cikin ƙwararrun likitocin dabbobinmu.",
        ig: "Biko chere ka m jikọọ gị na otu n'ime ndị ọkachamara veterinary anyị."
      }
    };

    return texts[key]?.[language] || texts[key]?.['en'] || '';
  }
}

export default new AfricasTalkingService();
