import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import africasTalkingService from '../services/africasTalkingService';
import aiService from '../services/aiService';
import sessionManager from '../utils/sessionManager';
import logger from '../utils/logger';
import config from '../config';

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
  
  async handleLanguageSelection(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits, recordingUrl, callRecordingUrl } = webhookData;
      
      logger.info(`=== LANGUAGE SELECTION WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(`Language selection - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}`);
      
      // If call is not active, end call
      if (isActive === "0") {
        const recording = recordingUrl || callRecordingUrl;
        if (recording) {
          logger.info(`Session ${sessionId} completed with recording. URL: ${recording}`);
        } else {
          logger.info(`Session ${sessionId} ended after language selection.`);
        }
        res.status(200).send('');
        return;
      }
      
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || '');
      let responseXML = '';
      let selectedLanguage = 'en';
      
      switch (choice) {
        case 1: // English
          selectedLanguage = 'en';
          responseXML = africasTalkingService.generateAIServiceMenuResponse('en');
          break;
          
        case 2: // Yoruba
          selectedLanguage = 'yo';
          responseXML = africasTalkingService.generateAIServiceMenuResponse('yo');
          break;
          
        case 3: // Hausa
          selectedLanguage = 'ha';
          responseXML = africasTalkingService.generateAIServiceMenuResponse('ha');
          break;
          
        case 4: // Repeat menu
          responseXML = africasTalkingService.generateLanguageMenuResponse();
          break;
          
        case 0: // End call
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for calling Agrocist. Have a great day!</Say>
  <Hangup/>
</Response>`;
          break;
          
        default:
          logger.warn(`Invalid language choice: ${choice} for session: ${sessionId}`);
          responseXML = africasTalkingService.generateLanguageMenuResponse();
      }
      
      // Store selected language in session if valid choice
      if (typeof choice === 'number' && [1, 2, 3].includes(choice)) {
        await sessionManager.updateSessionContext(sessionId, { language: selectedLanguage });
        await sessionManager.updateSessionMenu(sessionId, 'ai_service');
        logger.info(`Language ${selectedLanguage} selected for session: ${sessionId}`);
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling language selection:', error);
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
          // Store recording URL for later processing
          await sessionManager.updateSessionContext(sessionId, { 
            recordingUrl: recording,
            recordingDuration: callRecordingDurationInSeconds 
          });
        }
        res.status(200).send('');
        return;
      }
      
      // Store recording URL for immediate processing
      if (recording) {
        await sessionManager.updateSessionContext(sessionId, { 
          recordingUrl: recording,
          recordingDuration: callRecordingDurationInSeconds 
        });
      }

      // First, acknowledge the recording and let user know we're processing
      const processingXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for your question. Agrocist is analyzing your concern. Please wait a moment for your response.</Say>
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
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

  async handlePostAI(req: Request, res: Response): Promise<void> {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;
      const languageParam = req.query.language as string;
      
      logger.info(`=== POST-AI WEBHOOK ===`);
      logger.info(`Post-AI - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}, Language: ${languageParam}`);
      
      // If call is not active, end call
      if (isActive === "0") {
        logger.info(`Session ${sessionId} ended after post-AI.`);
        res.status(200).send('');
        return;
      }

      // If no DTMF digits, this is the initial redirect - show the post-AI menu
      if (!dtmfDigits) {
        const session = await sessionManager.getSession(sessionId);
        const language = languageParam || session?.context?.language || 'en';
        const responseXML = africasTalkingService.generatePostAIMenuResponse(language);
        
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }
      
      // Handle user's choice
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);
      let responseXML = '';
      
      switch (choice) {
        case 1: // Speak with human expert
          responseXML = africasTalkingService.generateTransferResponse();
          break;
          
        case 0: // End call
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for using Agrocist. Have a great day!</Say>
  <Hangup/>
</Response>`;
          break;
          
        default:
          // Get session to determine language for repeat prompt
          const session = await sessionManager.getSession(sessionId);
          const language = languageParam || session?.context?.language || 'en';
          responseXML = africasTalkingService.generatePostAIMenuResponse(language);
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling post-AI:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleAIProcessing(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.session as string;
      logger.info(`🤖 PROCESSING AI REQUEST for session: ${sessionId}`);
      
      // Get session data to retrieve recording URL
      const session = await sessionManager.getSession(sessionId);
      if (!session || !session.context.recordingUrl) {
        logger.error(`No recording URL found for session: ${sessionId}`);
        res.set('Content-Type', 'application/xml');
        res.send(africasTalkingService.generateErrorResponse());
        return;
      }

      // Transcribe the actual farmer's recording
      const farmerText = await aiService.transcribeAudio(session.context.recordingUrl);
      
      logger.info(`🎤 Transcribed farmer input: "${farmerText}"`);
      
      // Process with AI service using actual farmer concerns and selected language
      const language = session.context.language || 'en';
      const aiResponse = await aiService.processVeterinaryQuery(farmerText, {
        menu: 'veterinary_ai',
        farmerId: sessionId,
        language: language
      });
      
      logger.info(`🤖 AI Response: "${aiResponse.response}"`);

      // Store the AI interaction in session
      await sessionManager.addAIInteraction(sessionId, farmerText, aiResponse.response, 0.9, 'veterinary');
      
      // Clean up AI response - remove markdown and format for audio
      const cleanedResponse = this.cleanAIResponse(aiResponse.response);
      
      // Generate response with AI answer and redirect to post-AI menu
      const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">${cleanedResponse}</Say>
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?session=${sessionId}&language=${language}</Redirect>
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
  
}

export default new VoiceController();