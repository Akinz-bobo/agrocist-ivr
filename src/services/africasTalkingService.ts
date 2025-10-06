const AfricasTalking = require("africastalking");
import config from "../config";
import logger from "../utils/logger";

class AfricasTalkingService {
  private client;
  private voice;

  constructor() {
    this.client = AfricasTalking({
      apiKey: config.africasTalking.apiKey,
      username: config.africasTalking.username,
    });

    this.voice = this.client.VOICE;
  }

  generateResponse(text: string, nextAction?: string): string {
    let response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${text}</Say>`;

    switch (nextAction) {
      case "menu":
        response += this.getMainMenuXML();
        break;
      case "record":
        response += this.getRecordingXML();
        break;
      case "transfer":
        response += this.getTransferXML();
        break;
      case "end":
        response += `<Say voice="woman">Thank you for calling Agrocist. Have a great day!</Say>
  <Hangup/>`;
        break;
      default:
        response += this.getMainMenuXML();
    }

    response += `
</Response>`;

    return response;
  }

  generateWelcomeResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${this.getMainMenuXML()}
</Response>`;
  }

  generateMenuResponse(menuType: string): string {
    let menuXML = "";

    switch (menuType) {
      case "main":
      case "language":
        menuXML = this.getMainMenuXML();
        break;
      case "products":
        menuXML = this.getProductMenuXML();
        break;
      case "veterinary":
        menuXML = this.getVeterinaryMenuXML();
        break;
      default:
        menuXML = this.getMainMenuXML();
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${menuXML}
</Response>`;
  }

  generateRecordingResponse(prompt: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${prompt}</Say>
  ${this.getRecordingXML()}
</Response>`;
  }

  generateImmediateRecordingResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${this.getImmediateRecordingXML()}
</Response>`;
  }

  generateErrorResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">I'm sorry, I didn't understand that. Let me take you back to the main menu.</Say>
  ${this.getMainMenuXML()}
</Response>`;
  }

  generateTransferResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Please hold while I connect you to one of our veterinary experts.</Say>
  ${this.getTransferXML()}
</Response>`;
  }

  generateLanguageMenuResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${this.getMainMenuXML()}
</Response>`;
  }

  generateAIServiceMenuResponse(language: string): string {
    const prompts = {
      en: "You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.",
      yo: "Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́ (beep), kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.",
      ha: "Kun zaɓi Hausa. Don Allah ku bayyana matsalar dabbobinku. Ku yi magana a bayyane bayan sautin (beep), sannan ku danna hash idan kun gama.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${prompt}</Say>
  ${this.getRecordingXML()}
</Response>`;
  }

  generatePostAIMenuResponse(language: string): string {
    const prompts = {
      en: "Would you like to speak with a human veterinary expert? Press 1 to speak with an expert, or press 0 to end the call.",
      yo: "Ṣé ẹ fẹ́ bá amọ̀ràn oníwòsàn ẹranko sọ̀rọ̀? Ẹ tẹ́ ọ̀kan láti bá amọ̀ràn sọ̀rọ̀, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà.",
      ha: "Kana son yin magana da ƙwararren likitan dabbobi? Danna ɗaya don yin magana da ƙwararre, ko danna sifili don kammala kiran.",
    };

    const prompt = prompts[language as keyof typeof prompts] || prompts["en"];

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${prompt}</Say>
  <GetDigits timeout="8" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai">
    <Say voice="woman">${prompt}</Say>
  </GetDigits>
</Response>`;
  }

  // MAIN MENU
  private getMainMenuXML(): string {
    return `<GetDigits timeout="8" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language">
    <Say voice="woman">Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English. Fún Èdè Yorùbá, ẹ tẹ ẹ̀ẹ̀jì. Don Hausa, danna uku. Press 4 to repeat this menu. Press 0 to end the call.</Say>
  </GetDigits>`;
  }

  // PRODUCT MENU
  private getProductMenuXML(): string {
    return `<GetDigits timeout="5" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/products">
    <Say voice="woman">Press 1 for livestock medications. Press 2 for animal feed and supplements. Press 3 for treatment equipment. Press 9 to return to main menu. Press star to repeat this menu.</Say>
  </GetDigits>`;
  }

  // VETERINARY MENU
  private getVeterinaryMenuXML(): string {
    return `<GetDigits timeout="5" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/veterinary">
    <Say voice="woman">Press 1 to describe your animal's symptoms. Press 2 for general health advice. Press 3 for vaccination schedules. Press 4 to speak with a veterinarian. Press 9 to return to main menu.</Say>
  </GetDigits>`;
  }

  private getRecordingXML(): string {
    return `<Record timeout="10" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say voice="woman">Please describe your concern after the beep. Press hash when done, or wait for the recording to end automatically.</Say>
  </Record>`;
  }

  private getImmediateRecordingXML(): string {
    return `<Record timeout="10" trimSilence="true" playBeep="false" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say voice="woman">Please describe your livestock concern or question. Be as specific as possible about the animal type, symptoms, or issue you're experiencing.</Say>
  </Record>`;
  }

  private getTransferXML(): string {
    return `<Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer">
    <Say voice="woman">Connecting you now.</Say>
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
}

export default new AfricasTalkingService();
