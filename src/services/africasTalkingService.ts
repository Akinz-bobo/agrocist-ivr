const AfricasTalking = require("africastalking");
import config from "../config";
import logger from "../utils/logger";
import ttsService from "./ttsService";
import staticAudioService from "./staticAudioService";
import { stripQueryParams } from "../utils/urlUtils";

/**
 * Wraps the Africa's Talking Voice API.
 * Responsible for building all XML responses sent back to the AT platform,
 * and for delegating TTS audio generation to ttsService.
 */
class AfricasTalkingService {
  private voice: any;

  constructor() {
    const client = AfricasTalking({
      apiKey: config.africasTalking.apiKey,
      username: config.africasTalking.username,
    });
    this.voice = client.VOICE;
  }

  // ─── Welcome & Gate menu ──────────────────────────────────────────────────

  /**
   * Build the initial welcome XML that presents the gate menu:
   * "Press 1 for AI assistant, press 2 for human agent."
   * This is the very first response sent to every incoming caller.
   */
  async generateWelcomeResponse(): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getGateMenuXML()}
</Response>`;
  }

  /**
   * Build the gate menu XML standalone (used to replay the menu on invalid input or timeout).
   */
  async generateGateResponse(): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getGateMenuXML()}
</Response>`;
  }

  /**
   * Build the language selection menu XML — used after the caller chooses the AI path (press 1).
   * @deprecated The gate now routes directly to the language menu; kept for back-compat.
   */
  async generateLanguageMenuResponse(): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getMainMenuXML()}
</Response>`;
  }

  // ─── Recording prompts ─────────────────────────────────────────────────────

  /**
   * Build the recording prompt XML for a given language.
   * For non-English languages (yo/ha/ig), callers are transferred directly to
   * a language-specific agent instead of going through the AI flow.
   */
  async generateDirectRecordingResponse(language: string): Promise<string> {
    const lang = language as "en" | "yo" | "ha" | "ig";

    // Non-English callers go straight to a human agent
    if (lang !== "en") {
      return this.generateAgentTransferResponse(lang);
    }

    const audioUrl = staticAudioService.getStaticAudioUrl(
      lang,
      "directRecording",
    );
    const playTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(staticAudioService.getStaticText(lang, "directRecording"))}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    ${playTag}
  </Record>
</Response>`;
  }

  /**
   * Build the follow-up recording prompt XML (used when the caller asks another question).
   */
  async generateFollowUpRecordingResponse(language: string): Promise<string> {
    const lang = language as "en" | "yo" | "ha" | "ig";
    const audioUrl = staticAudioService.getStaticAudioUrl(
      lang,
      "followUpRecording",
    );
    const playTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(staticAudioService.getStaticText(lang, "followUpRecording"))}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    ${playTag}
  </Record>
</Response>`;
  }

  // ─── Post-AI menu ──────────────────────────────────────────────────────────

  /**
   * Build the post-AI menu XML that lets the caller choose their next action
   * (ask another question, speak to an agent, go to main menu, or end the call).
   */
  async generatePostAIMenuResponse(language: string): Promise<string> {
    const lang = (language as "en" | "yo" | "ha" | "ig") || "en";
    const audioUrl = staticAudioService.getStaticAudioUrl(lang, "postAIMenu");
    const playTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(staticAudioService.getStaticText(lang, "postAIMenu"))}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="4" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai?language=${lang}">
    ${playTag}
  </GetDigits>
  ${playTag}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?language=${lang}</Redirect>
</Response>`;
  }

  // ─── Transfer & Error ──────────────────────────────────────────────────────

  /**
   * Build the agent transfer XML (plays a hold message then dials the agent).
   */
  async generateTransferResponse(
    language: "en" | "yo" | "ha" | "ig" = "en",
  ): Promise<string> {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.getTransferXML(language)}
</Response>`;
  }

  /**
   * Build the error response XML (plays an error message then redirects to the main menu).
   */
  async generateErrorResponse(
    language: "en" | "yo" | "ha" | "ig" = "en",
  ): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, "error");

    if (audioUrl) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="${stripQueryParams(audioUrl)}"/>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${this.escapeXML(staticAudioService.getStaticText(language, "error"))}</Say>
  <Redirect>${config.webhook.baseUrl}/voice</Redirect>
</Response>`;
  }

  // ─── TTS ───────────────────────────────────────────────────────────────────

  /**
   * Generate TTS audio for dynamic text (AI responses).
   * Returns a hosted URL, or null if generation fails (caller should fall back to <Say>).
   */
  async generateTTSAudio(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string = "unknown",
    sessionId?: string,
  ): Promise<string | null> {
    try {
      const result = await ttsService.generateAIAudio(
        text,
        language,
        phoneNumber,
        sessionId,
      );
      return result.audioUrl;
    } catch (error) {
      const tag = sessionId ? ` [${sessionId.slice(-8)}]` : "";
      logger.error(`TTS${tag} failed for ${language}:`, error);
      return null;
    }
  }

  /** Returns true — TTS is always considered available (Spitch is the sole provider). */
  isTTSAvailable(): boolean {
    return true;
  }

  // ─── DTMF helpers ──────────────────────────────────────────────────────────

  /** Returns true if the string contains only valid DTMF characters. */
  isValidDTMF(dtmf: string): boolean {
    return /^[0-9*#]+$/.test(dtmf);
  }

  /**
   * Parse a DTMF string into a numeric menu choice.
   * Returns 'repeat' for *, 'finish' for #, or the first digit as a number.
   */
  extractMenuChoice(dtmf: string): number | string {
    if (!dtmf) return 0;
    if (dtmf === "*") return "repeat";
    if (dtmf === "#") return "finish";
    const choice = parseInt(dtmf.charAt(0));
    return isNaN(choice) ? 0 : choice;
  }

  // ─── Outbound calls ────────────────────────────────────────────────────────

  /** Initiate an outbound call via Africa's Talking. */
  async makeCall(phoneNumber: string): Promise<boolean> {
    try {
      await this.voice.call({
        to: phoneNumber,
        from: config.africasTalking.shortCode,
      });
      logger.info(`Outbound call initiated to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`Failed to initiate call to ${phoneNumber}:`, error);
      return false;
    }
  }

  // ─── Private XML builders ──────────────────────────────────────────────────

  /**
   * Build the gate menu XML fragment.
   * Plays the welcome audio inside a GetDigits tag so the caller can press
   * 1 (AI assistant) or 2 (human agent) at any point during playback.
   * On timeout, GetDigits itself redirects to /voice/gate with no digits.
   */
  private async getGateMenuXML(): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl("en", "welcome");
    const audioTag = audioUrl
      ? `    <Play url="${stripQueryParams(audioUrl)}"/>`
      : `    <Say>${this.escapeXML(staticAudioService.getStaticText("en", "welcome"))}</Say>`;

    return `<GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/gate">
${audioTag}
  </GetDigits>`;
  }

  /**
   * Build the language-selection menu XML fragment (AI path, after gate press 1).
   */
  private async getMainMenuXML(): Promise<string> {
    const LANGUAGE_MENU_TEXT =
      "Press 1 for English, 2 for Yoruba, 3 for Hausa, or 4 for Igbo.";
    const audioUrl = staticAudioService.getStaticAudioUrl(
      "en",
      "languageTimeout",
    );
    const audioTag = audioUrl
      ? `    <Play url="${stripQueryParams(audioUrl)}"/>`
      : `    <Say>${this.escapeXML(LANGUAGE_MENU_TEXT)}</Say>`;

    return `<GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
${audioTag}
  </GetDigits>`;
  }

  /**
   * Build the agent transfer XML fragment (hold message + Dial tag).
   * Uses the default agent number from config.
   */
  private async getTransferXML(
    language: "en" | "yo" | "ha" | "ig" = "en",
  ): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, "transfer");
    const audioTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(staticAudioService.getStaticText(language, "transfer"))}</Say>`;

    return `${audioTag}
  <Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>`;
  }

  /**
   * Build a direct agent transfer response for non-English languages.
   * Each language has its own dedicated agent phone number (configurable via env vars).
   */
  private async generateAgentTransferResponse(
    language: "en" | "yo" | "ha" | "ig",
  ): Promise<string> {
    const agentNumbers: Record<string, string> = {
      yo: process.env.YO_AGENT_PHONE ?? config.agent.phoneNumber,
      ha: process.env.HA_AGENT_PHONE ?? config.agent.phoneNumber,
      ig: process.env.IG_AGENT_PHONE ?? config.agent.phoneNumber,
      en: config.agent.phoneNumber,
    };

    const audioUrl = staticAudioService.getStaticAudioUrl(language, "transfer");
    const audioTag = audioUrl
      ? `<Play url="${stripQueryParams(audioUrl)}"/>`
      : `<Say>${this.escapeXML(staticAudioService.getStaticText(language, "transfer"))}</Say>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioTag}
  <Dial phoneNumbers="${agentNumbers[language]}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer"/>
</Response>`;
  }

  /** Escape special XML characters to prevent malformed XML responses. */
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
