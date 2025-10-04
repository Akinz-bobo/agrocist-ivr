const AfricasTalking = require('africastalking');
import config from '../config';
import logger from '../utils/logger';

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
      case 'menu':
        response += this.getMainMenuXML();
        break;
      case 'record':
        response += this.getRecordingXML();
        break;
      case 'transfer':
        response += this.getTransferXML();
        break;
      case 'end':
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
  <Say voice="woman">Welcome to Agrocist, your trusted livestock farming partner. We provide veterinary support, farm record management, and quality agricultural products.</Say>
  ${this.getMainMenuXML()}
</Response>`;
  }
  
  generateMenuResponse(menuType: string): string {
    let menuXML = '';
    
    switch (menuType) {
      case 'main':
        menuXML = this.getMainMenuXML();
        break;
      case 'products':
        menuXML = this.getProductMenuXML();
        break;
      case 'veterinary':
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
  
  private getMainMenuXML(): string {
    return `<GetDigits timeout="8" finishOnKey="#" numDigits="1" callbackUrl="${config.webhook.baseUrl}/voice/menu">
    <Say voice="woman">Press 1 for farm records. Press 2 for veterinary help. Press 3 for products. Press 4 for vet consultation.</Say>
  </GetDigits>`;
  }
  
  private getProductMenuXML(): string {
    return `<GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/products">
    <Say voice="woman">Press 1 for livestock medications. Press 2 for animal feed and supplements. Press 3 for treatment equipment. Press 9 to return to main menu. Press star to repeat this menu.</Say>
  </GetDigits>`;
  }
  
  private getVeterinaryMenuXML(): string {
    return `<GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/veterinary">
    <Say voice="woman">Press 1 to describe your animal's symptoms. Press 2 for general health advice. Press 3 for vaccination schedules. Press 4 to speak with a veterinarian. Press 9 to return to main menu.</Say>
  </GetDigits>`;
  }
  
  private getRecordingXML(): string {
    return `<Record timeout="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/recording">
    <Say voice="woman">Please describe your concern after the beep. Press hash when you're finished, or wait for the recording to end automatically.</Say>
  </Record>`;
  }
  
  private getTransferXML(): string {
    return `<Dial phoneNumbers="${config.agent.phoneNumber}" record="true" sequential="true" callbackUrl="${config.webhook.baseUrl}/voice/transfer">
    <Say voice="woman">Connecting you now.</Say>
  </Dial>`;
  }
  
  async makeCall(phoneNumber: string, message: string): Promise<boolean> {
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
      logger.info('Media uploaded:', result);
      return result.mediaId;
    } catch (error) {
      logger.error('Error uploading media:', error);
      return null;
    }
  }
  
  isValidDTMF(dtmf: string): boolean {
    return /^[0-9*#]+$/.test(dtmf);
  }
  
  extractMenuChoice(dtmf: string): number | string {
    if (!dtmf) return 0;
    
    // Handle special keys
    if (dtmf === '*') return 'repeat';
    if (dtmf === '#') return 'finish';
    
    // Handle numeric choices
    const choice = parseInt(dtmf.charAt(0));
    return isNaN(choice) ? 0 : choice;
  }
}

export default new AfricasTalkingService();