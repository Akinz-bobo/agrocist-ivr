import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import sessionManager from '../utils/sessionManager';
import africasTalkingService from '../services/africasTalkingService';
import aiService from '../services/aiService';
import logger from '../utils/logger';

class VoiceController {
  
  async handleIncomingCall(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, phoneNumber } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Incoming call - Session: ${sessionId}, Phone: ${phoneNumber}`);
      
      // Create new session
      await sessionManager.createSession(sessionId, phoneNumber);
      
      // Generate welcome response
      const welcomeXML = africasTalkingService.generateWelcomeResponse();
      
      res.set('Content-Type', 'application/xml');
      res.send(welcomeXML);
      
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleMenuSelection(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, dtmfDigits } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Menu selection - Session: ${sessionId}, DTMF: ${dtmfDigits}`);
      
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        logger.warn(`Session not found: ${sessionId}`);
        res.set('Content-Type', 'application/xml');
        res.send(africasTalkingService.generateErrorResponse());
        return;
      }
      
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || '');
      let responseXML = '';
      
      switch (choice) {
        case 1: // Farm Records
          await sessionManager.updateSessionMenu(sessionId, 'farm_records');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please state your farm ID or farmer name, and what information you need about your farm."
          );
          break;
          
        case 2: // Veterinary Help
          await sessionManager.updateSessionMenu(sessionId, 'veterinary_ai');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please describe your livestock concern or question. Be as specific as possible about the animal type, symptoms, or issue you're experiencing."
          );
          break;
          
        case 3: // Product Orders
          await sessionManager.updateSessionMenu(sessionId, 'products');
          responseXML = africasTalkingService.generateMenuResponse('products');
          break;
          
        case 4: // Speak with Vet
          await sessionManager.updateSessionMenu(sessionId, 'transfer_request');
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
  
  async handleProductMenu(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, dtmfDigits } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Product menu - Session: ${sessionId}, DTMF: ${dtmfDigits}`);
      
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        res.set('Content-Type', 'application/xml');
        res.send(africasTalkingService.generateErrorResponse());
        return;
      }
      
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || '');
      let responseXML = '';
      
      switch (choice) {
        case 1: // Medications
          await sessionManager.updateSessionMenu(sessionId, 'medications');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please specify the type of medication you need, the animal type, and any specific requirements."
          );
          break;
          
        case 2: // Feed
          await sessionManager.updateSessionMenu(sessionId, 'feed');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please tell us about the feed you need, including animal type, age, and quantity required."
          );
          break;
          
        case 3: // Treatment Equipment
          await sessionManager.updateSessionMenu(sessionId, 'equipment');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please describe the treatment equipment or supplies you need."
          );
          break;
          
        case 9: // Return to main menu
          await sessionManager.updateSessionMenu(sessionId, 'main');
          responseXML = africasTalkingService.generateWelcomeResponse();
          break;
          
        case 'repeat':
          responseXML = africasTalkingService.generateMenuResponse('products');
          break;
          
        default:
          responseXML = africasTalkingService.generateErrorResponse();
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling product menu:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleVeterinaryMenu(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, dtmfDigits } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Veterinary menu - Session: ${sessionId}, DTMF: ${dtmfDigits}`);
      
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        res.set('Content-Type', 'application/xml');
        res.send(africasTalkingService.generateErrorResponse());
        return;
      }
      
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || '');
      let responseXML = '';
      
      switch (choice) {
        case 1: // Describe symptoms
          await sessionManager.updateSessionMenu(sessionId, 'symptoms');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please describe your animal's symptoms in detail. Include the animal type, breed if known, and how long the symptoms have been present."
          );
          break;
          
        case 2: // General health advice
          await sessionManager.updateSessionMenu(sessionId, 'health_advice');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please ask your general health question about livestock care, nutrition, or preventive measures."
          );
          break;
          
        case 3: // Vaccination schedules
          await sessionManager.updateSessionMenu(sessionId, 'vaccination');
          responseXML = africasTalkingService.generateRecordingResponse(
            "Please specify the animal type and age for vaccination schedule information."
          );
          break;
          
        case 4: // Speak with veterinarian
          await sessionManager.updateSessionMenu(sessionId, 'transfer_request');
          responseXML = africasTalkingService.generateTransferResponse();
          break;
          
        case 9: // Return to main menu
          await sessionManager.updateSessionMenu(sessionId, 'main');
          responseXML = africasTalkingService.generateWelcomeResponse();
          break;
          
        case 'repeat':
          responseXML = africasTalkingService.generateMenuResponse('veterinary');
          break;
          
        default:
          responseXML = africasTalkingService.generateErrorResponse();
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling veterinary menu:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleRecording(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, recordingUrl } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Recording received - Session: ${sessionId}, URL: ${recordingUrl}`);
      
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        res.set('Content-Type', 'application/xml');
        res.send(africasTalkingService.generateErrorResponse());
        return;
      }
      
      // For MVP, we'll simulate speech-to-text conversion
      // In production, integrate with Google Speech-to-Text or similar service
      const simulatedText = this.simulateSpeechToText(session.currentMenu);
      
      let aiResponse;
      
      // Process based on current menu context
      switch (session.currentMenu) {
        case 'veterinary_ai':
        case 'symptoms':
        case 'health_advice':
        case 'vaccination':
          aiResponse = await aiService.processVeterinaryQuery(simulatedText, {
            menu: session.currentMenu,
            farmerId: session.context.farmerId
          });
          break;
          
        case 'farm_records':
          aiResponse = await aiService.processGeneralQuery(simulatedText, {
            menu: session.currentMenu,
            type: 'farm_records'
          });
          break;
          
        case 'medications':
        case 'feed':
        case 'equipment':
          aiResponse = await aiService.processGeneralQuery(simulatedText, {
            menu: session.currentMenu,
            type: 'products'
          });
          break;
          
        default:
          aiResponse = await aiService.processGeneralQuery(simulatedText);
      }
      
      // Store AI interaction
      await sessionManager.addAIInteraction(
        sessionId,
        simulatedText,
        aiResponse.response,
        0.8, // Mock confidence for now
        this.getCategoryFromMenu(session.currentMenu)
      );
      
      const responseXML = africasTalkingService.generateResponse(
        aiResponse.response,
        aiResponse.nextAction
      );
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling recording:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleTransfer(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, hangupCause } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Transfer completed - Session: ${sessionId}, Cause: ${hangupCause}`);
      
      // Log the transfer completion
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        session.context.transferCompleted = true;
        session.context.transferTime = new Date();
        await sessionManager.saveSession(session);
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Thank you for using Agrocist. We hope we were able to help you today.</Say>
  <Hangup/>
</Response>`);
      
    } catch (error) {
      logger.error('Error handling transfer:', error);
      res.set('Content-Type', 'application/xml');
      res.send(africasTalkingService.generateErrorResponse());
    }
  }
  
  async handleCallEnd(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, durationInSeconds } = req.body as AfricasTalkingWebhook;
      
      logger.info(`Call ended - Session: ${sessionId}, Duration: ${durationInSeconds}s`);
      
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        // Store call summary in database here
        // For now, just log the session data
        logger.info(`Call summary for ${sessionId}:`, {
          duration: durationInSeconds,
          menuHistory: session.menuHistory,
          aiInteractions: session.aiInteractions.length,
          callerNumber: session.callerNumber
        });
        
        // Clean up session
        await sessionManager.deleteSession(sessionId);
      }
      
      res.status(200).json({ success: true });
      
    } catch (error) {
      logger.error('Error handling call end:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  private simulateSpeechToText(menu: string): string {
    // Mock speech-to-text conversion based on menu context
    // In production, replace with actual speech recognition service
    
    const mockResponses: Record<string, string> = {
      'veterinary_ai': 'My cow has been coughing and has a runny nose for the past two days',
      'symptoms': 'My chicken is not eating and looks weak, it has been like this since yesterday',
      'health_advice': 'What is the best way to prevent diseases in goats during the rainy season',
      'vaccination': 'When should I vaccinate my 3 month old calves',
      'farm_records': 'I need information about my farm with ID number 12345',
      'medications': 'I need antibiotics for my sick pig, it weighs about 50 kilograms',
      'feed': 'I want to buy protein feed for my 200 broiler chickens',
      'equipment': 'I need syringes and needles for vaccination'
    };
    
    return mockResponses[menu] || 'I need help with my livestock';
  }
  
  private getCategoryFromMenu(menu: string): 'veterinary' | 'farm_records' | 'products' | 'general' {
    if (['veterinary_ai', 'symptoms', 'health_advice', 'vaccination'].includes(menu)) {
      return 'veterinary';
    }
    if (menu === 'farm_records') {
      return 'farm_records';
    }
    if (['medications', 'feed', 'equipment'].includes(menu)) {
      return 'products';
    }
    return 'general';
  }
}

export default new VoiceController();