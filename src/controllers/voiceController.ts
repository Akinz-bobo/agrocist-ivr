import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import africasTalkingService from '../services/africasTalkingService';
import aiService from '../services/aiService';
import logger from '../utils/logger';

class VoiceController {
  
  async handleIncomingCall(req: Request, res: Response): Promise<void> {
    try {
      // Africa's Talking sends form data - extract from req.body
      const webhookData = req.body as any;
      logger.info(`=== INCOMING WEBHOOK REQUEST ===`);
      logger.info(`Content-Type: ${req.get('Content-Type')}`);
      logger.info(`Method: ${req.method}`);
      logger.info(`URL: ${req.url}`);
      logger.info(`Headers:`, req.headers);
      logger.info(`Full webhook data received:`, JSON.stringify(webhookData, null, 2));
      
      const { 
        sessionId, 
        isActive, 
        callerNumber, 
        destinationNumber,
        direction,
        callStartTime,
        callStatus,
        call_status,
        durationInSeconds,
        callType,
        callEndTime,
        callDurationInSeconds,
        callEndReason,
        callRecordingUrl,
        callRecordingDurationInSeconds
      } = webhookData;
      
      logger.info(`PARSED DATA - Session: ${sessionId}, Active: ${isActive}, Caller: ${callerNumber}, Destination: ${destinationNumber}, Duration: ${durationInSeconds}s`);
      
      // CRITICAL: Follow exact Python pattern - if isActive is "0", return empty response
      if (isActive === "0") {
        logger.info("❌ CALL COMPLETION EVENT (isActive=0) - returning empty response.", { 
          sessionId, 
          callerNumber, 
          duration: durationInSeconds,
          callStatus: callStatus || call_status
        });
        res.status(200).send('');
        return;
      }
      
      // For active incoming calls (isActive="1"), respond with IVR XML
      logger.info("✅ ACTIVE INCOMING CALL (isActive=1) - generating IVR response", { 
        sessionId, 
        callerNumber, 
        destinationNumber, 
        isActive 
      });
      
      // Generate welcome response
      const welcomeXML = africasTalkingService.generateWelcomeResponse();
      
      logger.info("🎤 SENDING IVR XML RESPONSE:", welcomeXML);
      res.set('Content-Type', 'application/xml');
      res.send(welcomeXML);
      
    } catch (error) {
      logger.error('💥 ERROR handling incoming call:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleMenuSelection(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits, recordingUrl, callRecordingUrl } = webhookData;
      
      logger.info(`=== MENU SELECTION WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(`Menu selection - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}`);
      
      // If call is not active, handle recording or end call
      if (isActive === "0") {
        const recording = recordingUrl || callRecordingUrl;
        if (recording) {
          logger.info(`Session ${sessionId} completed with recording. URL: ${recording}`);
        } else {
          logger.info(`Session ${sessionId} ended after GetDigits without recording.`);
        }
        res.status(200).send('');
        return;
      }
      
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || '');
      let responseXML = '';
      
      switch (choice) {
        case 1: // Farm Records
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please state your farm ID or farmer name, and what information you need about your farm."
          );
          break;
          
        case 2: // Veterinary Help
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please describe your livestock concern or question. Be as specific as possible about the animal type, symptoms, or issue you're experiencing."
          );
          break;
          
        case 3: // Product Orders
          responseXML = africasTalkingService.generateMenuResponse('products');
          break;
          
        case 4: // Speak with Vet
          responseXML = africasTalkingService.generateTransferResponse();
          break;
          
        case 'repeat':
          responseXML = africasTalkingService.generateWelcomeResponse();
          break;
          
        default:
          logger.warn(`Invalid menu choice: ${choice} for session: ${sessionId}`);
          responseXML = africasTalkingService.generateErrorResponse();
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling menu selection:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleRecording(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, recordingUrl, callRecordingUrl, callRecordingDurationInSeconds } = webhookData;
      
      const recording = recordingUrl || callRecordingUrl;
      logger.info(`=== RECORDING WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(`Recording received - Session: ${sessionId}, Active: ${isActive}, URL: ${recording}, Duration: ${callRecordingDurationInSeconds}s`);
      
      // If call is not active, just log and return empty response
      if (isActive === "0") {
        if (recording) {
          logger.info(`Session ${sessionId}: Recording completed. URL: ${recording}, Duration: ${callRecordingDurationInSeconds}s`);
        }
        res.status(200).send('');
        return;
      }
      
      // First, acknowledge the recording and let user know we're processing
      const processingXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for your question. Agrocist is analyzing your concern. Please wait a moment for your response.</Say>
  <Redirect>${process.env.WEBHOOK_BASE_URL}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;
      
      logger.info(`🎤 SENDING PROCESSING MESSAGE:`, processingXML);
      res.set('Content-Type', 'application/xml');
      res.send(processingXML);
      
    } catch (error) {
      logger.error('💥 ERROR handling recording:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleAIProcessing(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.session as string;
      logger.info(`🤖 PROCESSING AI REQUEST for session: ${sessionId}`);
      
      // For MVP, we'll simulate speech-to-text conversion and provide AI response
      // In production, integrate with Google Speech-to-Text or similar service
      const simulatedText = "My cow has been coughing and has a runny nose for the past two days. What should I do?";
      
      logger.info(`🎤 Simulated speech-to-text: "${simulatedText}"`);
      
      // Process with AI service
      const aiResponse = await aiService.processVeterinaryQuery(simulatedText, {
        menu: 'veterinary_ai',
        farmerId: sessionId
      });
      
      logger.info(`🤖 AI Response: "${aiResponse.response}"`);
      
      // Clean up AI response - remove markdown and format for audio
      const cleanedResponse = this.cleanAIResponse(aiResponse.response);
      
      // Generate response with AI answer and option to continue
      const responseText = `${cleanedResponse}. Press 1 to ask another question, or 9 to return to the main menu.`;
      
      const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${responseText}</Say>
  <GetDigits timeout="8" finishOnKey="#" numDigits="1" callbackUrl="${process.env.WEBHOOK_BASE_URL}/voice/menu">
    <Say voice="woman">Press 1 for another question or 9 for main menu.</Say>
  </GetDigits>
</Response>`;
      
      logger.info(`🎤 SENDING AI RESPONSE XML:`, responseXML);
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('💥 ERROR processing AI request:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  private cleanAIResponse(response: string): string {
    // Remove markdown formatting, stars, and clean up for audio
    return response
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '')   // Remove italic markdown
      .replace(/##/g, '')   // Remove heading markdown
      .replace(/#/g, '')    // Remove heading markdown
      .replace(/\n/g, '. ') // Replace newlines with periods
      .replace(/\s+/g, ' ') // Remove extra spaces
      .trim();
  }
  
  private simulateSpeechToText(menu: string): string {
    // Mock speech-to-text conversion based on menu context
    const mockResponses: Record<string, string> = {
      'veterinary_ai': 'My cow has been coughing and has a runny nose for the past two days',
      'farm_records': 'I need information about my farm with ID number 12345',
      'medications': 'I need antibiotics for my sick pig, it weighs about 50 kilograms',
      'feed': 'I want to buy protein feed for my 200 broiler chickens'
    };
    
    return mockResponses[menu] || 'I need help with my livestock';
  }
}

export default new VoiceController();