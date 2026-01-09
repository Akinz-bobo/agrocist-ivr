const AfricasTalking = require("africastalking");
import config from "../config";
import logger from "../utils/logger";
import ttsService, { TTSOptions } from "./ttsService";
import staticAudioService from "./staticAudioService";
import { stripQueryParams } from "../utils/urlUtils";

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

  async generateResponse(
    text: string,
    language: "en" | "yo" | "ha" | "ig" = "en",
    nextAction?: string
  ): Promise<string> {
    let response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

    // Generate TTS audio for the main text using proper voice selection
    const audioUrl = await this.generateTTSAudio(text, language);
    response += audioUrl
      ? `  <Play url="${stripQueryParams(audioUrl)}"/>`
      : `  <Say>${this.escapeXML(text)}</Say>`;

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
        const endAudioUrl = staticAudioService.getStaticAudioUrl(
          language,
          "goodbye"
        );
        if (endAudioUrl) {
          response += `  <Play url="${stripQueryParams(endAudioUrl)}"/>`;
        } else {
          const endText = staticAudioService.getStaticText(language, "goodbye");
          response += `  <Say voice="${this.getVoiceForLanguage(
            language
          )}" playBeep="false">${this.escapeXML(endText)}</Say>`;
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

  async generateRecordingResponse(
    prompt: string,
    language: "en" | "yo" | "ha" | "ig" = "en"
  ): Promise<string> {
    const audioUrl = await this.generateTTSAudio(prompt, language);
    const playTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(prompt)}</Say>`;

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

  async generateErrorResponse(
    language: "en" | "yo" | "ha" | "ig" = "en"
  ): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, "error");

    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="${stripQueryParams(audioUrl)}"/>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
    }

    // Fallback to text if static audio not available
    const errorText = staticAudioService.getStaticText(language, "error");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${this.escapeXML(errorText)}</Say>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
  }

  async generateTransferResponse(
    language: "en" | "yo" | "ha" | "ig" = "en"
  ): Promise<string> {
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
    // Route yo, ha, ig languages directly to agents
    if (language === "yo" || language === "ha" || language === "ig") {
      return this.generateAgentTransferResponse(language as "en" | "yo" | "ha" | "ig");
    }

    // Only English continues with recording
    const audioUrl = staticAudioService.getStaticAudioUrl(
      language as "en" | "yo" | "ha" | "ig",
      "directRecording"
    );

    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${
    config.webhook.baseUrl
  }/voice/recording">
    <Play url="${stripQueryParams(audioUrl)}"/>
  </Record>
</Response>`;
    }

    // Fallback to text if static audio not available
    const prompt = staticAudioService.getStaticText(
      language as "en" | "yo" | "ha" | "ig",
      "directRecording"
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${
    config.webhook.baseUrl
  }/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
  }

  private async generateAgentTransferResponse(
    language: "en" | "yo" | "ha" | "ig"
  ): Promise<string> {
    const agentNumbers = {
      yo: process.env.YO_AGENT_PHONE || config.agent.phoneNumber,
      ha: process.env.HA_AGENT_PHONE || config.agent.phoneNumber,
      ig: process.env.IG_AGENT_PHONE || config.agent.phoneNumber,
      en: config.agent.phoneNumber,
    };

    const audioUrl = staticAudioService.getStaticAudioUrl(language, "transfer");

    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="${stripQueryParams(audioUrl)}"/>
  <Dial phoneNumbers="${agentNumbers[language]}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>
</Response>`;
    }

    // Fallback to text if static audio not available
    const transferText = staticAudioService.getStaticText(language, "transfer");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${this.escapeXML(transferText)}</Say>
  <Dial phoneNumbers="${agentNumbers[language]}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>
</Response>`;
  }

  async generateFollowUpRecordingResponse(language: string): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(
      language as "en" | "yo" | "ha" | "ig",
      "followUpRecording"
    );

    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${
    config.webhook.baseUrl
  }/voice/recording">
    <Play url="${stripQueryParams(audioUrl)}"/>
  </Record>
</Response>`;
    }

    // Fallback to text if static audio not available
    const prompt = staticAudioService.getStaticText(
      language as "en" | "yo" | "ha" | "ig",
      "followUpRecording"
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${
    config.webhook.baseUrl
  }/voice/recording">
    <Say>${this.escapeXML(prompt)}</Say>
  </Record>
</Response>`;
  }

  async generatePostAIMenuResponse(language: string): Promise<string> {
    const prompts = {
      en: "Press 1 for another question, press 2 to speak with a human expert, press 3 to go back to main menu, or press 0 to end the call.",
      yo: "Ṣé ẹ fẹ́ bá dokita oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀okan láti bá onímọ̀ eranko sọ̀rọ̀, tàbí ki ẹ tẹ́ hassi láti parí ìpè rẹ.",
      ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
      ig: "Ị nwere nsogbu ndị ọzọ? Pịa 1 iji jụọ ajụjụ ọzọ, pịa 2 iji kwuo okwu na ọkachamara mmadụ, pịa 3 iji laghachi na menu izizi, ma ọ bụ pịa 0 iji kwụsị oku a.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];
    const langCode = (language as "en" | "yo" | "ha" | "ig") || "en";

    // Try to use static audio for post-AI menu
    const audioUrl = staticAudioService.getStaticAudioUrl(
      langCode,
      "postAIMenu"
    );
    let playTag: string;

    if (audioUrl) {
      playTag = `<Play url="${stripQueryParams(audioUrl)}"/>`;
    } else {
      // Fallback to static text if audio not available
      const staticPrompt = staticAudioService.getStaticText(
        langCode,
        "postAIMenu"
      );
      playTag = `<Say>${this.escapeXML(staticPrompt)}</Say>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="4" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai?language=${langCode}">
    ${playTag}
  </GetDigits>
  ${playTag}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?language=${langCode}</Redirect>
</Response>`;
  }

  // MAIN MENU
  private async getMainMenuXML(): Promise<string> {
    // Generate multi-language welcome message with appropriate voices
    const welcomeXML = await this.generateMultiLanguageWelcome();

    // Put audio INSIDE GetDigits with proper formatting, add Redirect for timeout handling

    return `<GetDigits timeout="5" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
${welcomeXML}
  </GetDigits>
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>`;
  }

  /**
   * Generate multi-language welcome message using pre-generated static audio
   */
  private async generateMultiLanguageWelcome(): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl("en", "welcome");

    if (audioUrl) {
      return `    <Play url="${stripQueryParams(audioUrl)}"/>`;
    }

    // Fallback to text if static audio not available
    const welcomeText = staticAudioService.getStaticText("en", "welcome");
    return `    <Say>${this.escapeXML(welcomeText)}</Say>`;
  }

  private async getRecordingXML(
    _language: "en" | "yo" | "ha" | "ig" = "en"
  ): Promise<string> {
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

  private async getTransferXML(
    language: "en" | "yo" | "ha" | "ig" = "en"
  ): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, "transfer");

    if (audioUrl) {
      return `<Play url="${stripQueryParams(audioUrl)}"/>
  <Dial phoneNumbers="${
    config.agent.phoneNumber
  }" record="true" sequential="true" callbackUrl="${
        config.webhook.baseUrl
      }/voice/transfer"/>`;
    }

    // Fallback to text if static audio not available
    const transferText = staticAudioService.getStaticText(language, "transfer");
    return `<Say voice="${this.getVoiceForLanguage(
      language
    )}" playBeep="false">${this.escapeXML(transferText)}</Say>
  <Dial phoneNumbers="${
    config.agent.phoneNumber
  }" record="true" sequential="true" callbackUrl="${
      config.webhook.baseUrl
    }/voice/transfer"/>`;
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
    return true;
  }

  /**
   * Generate TTS audio for text in specified language
   */
  async generateTTSAudio(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string = "unknown",
    sessionId?: string
  ): Promise<string | null> {
    try {
      const actualLanguage = language;

      const result = await ttsService.generateAIAudio(
        text,
        actualLanguage,
        phoneNumber,
        sessionId
      );
      return result.audioUrl;
    } catch (error) {
      const sessionInfo = sessionId ? ` [${sessionId.slice(-8)}]` : "";
      logger.error(`TTS${sessionInfo} failed for ${language}:`, error);
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
  private getVoiceForLanguage(language: "en" | "yo" | "ha" | "ig"): string {
    // Use simple 'woman' voice - more compatible with Africa's Talking
    return "woman";
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export default new AfricasTalkingService();
