import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import africasTalkingService from '../services/africasTalkingService';
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
}

export default new VoiceController();