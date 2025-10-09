import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import africasTalkingService from '../services/africasTalkingService';
import aiService from '../services/aiService';
import sessionManager from '../utils/sessionManager';
import logger from '../utils/logger';
import config from '../config';

class VoiceController {

  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
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

      // Create session for the incoming call
      if (sessionId && callerNumber) {
        sessionManager.createSession(sessionId, callerNumber);
        logger.info(`📝 Created session for incoming call: ${sessionId}`);
      }
      
      // Generate welcome response
      const welcomeXML = await africasTalkingService.generateWelcomeResponse();

      logger.info("🎤 SENDING IVR XML RESPONSE:");
      logger.info(welcomeXML);
      res.set('Content-Type', 'application/xml');
      res.send(welcomeXML);
      
    } catch (error) {
      logger.error('💥 ERROR handling incoming call:', error);
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse());
    }
  }
  
  handleLanguageSelection = async (req: Request, res: Response): Promise<void> => {
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
      const ttsAvailable = africasTalkingService.isTTSAvailable();
      
      // If TTS is not available, only allow English (option 1) or end call (option 0)
      if (!ttsAvailable && typeof choice === 'number' && ![1, 0].includes(choice)) {
        logger.warn(`TTS unavailable, rejecting non-English choice: ${choice} for session: ${sessionId}`);
        responseXML = await africasTalkingService.generateLanguageMenuResponse();
      } else {
        switch (choice) {
          case 1: // English
            selectedLanguage = 'en';
            responseXML = await africasTalkingService.generateDirectRecordingResponse('en');
            break;
            
          case 2: // Yoruba (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = 'yo';
              responseXML = await africasTalkingService.generateDirectRecordingResponse('yo');
            } else {
              logger.warn(`TTS unavailable, rejecting Yoruba choice for session: ${sessionId}`);
              responseXML = await africasTalkingService.generateLanguageMenuResponse();
            }
            break;
            
          case 3: // Hausa (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = 'ha';
              responseXML = await africasTalkingService.generateDirectRecordingResponse('ha');
            } else {
              logger.warn(`TTS unavailable, rejecting Hausa choice for session: ${sessionId}`);
              responseXML = await africasTalkingService.generateLanguageMenuResponse();
            }
            break;
            
          case 4: // Repeat menu
            responseXML = await africasTalkingService.generateLanguageMenuResponse();
            break;
            
          case 0: // End call
            const goodbyeMessage = this.getGoodbyeMessage(selectedLanguage as 'en' | 'yo' | 'ha');
            responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(goodbyeMessage, selectedLanguage as 'en' | 'yo' | 'ha')}
</Response>`;
            break;
            
          default:
            logger.warn(`Invalid language choice: ${choice} for session: ${sessionId}`);
            responseXML = await africasTalkingService.generateLanguageMenuResponse();
        }
      }
      
      // Store selected language in session if valid choice - both in context AND at session level
      if (typeof choice === 'number' && [1, 2, 3].includes(choice)) {
        // Update in both places for maximum persistence
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.language = selectedLanguage as 'en' | 'yo' | 'ha';
          sessionManager.saveSession(session);
        }
        sessionManager.updateSessionContext(sessionId, { language: selectedLanguage });
        sessionManager.updateSessionMenu(sessionId, 'recording');
        logger.info(`✅ Language ${selectedLanguage} LOCKED for session: ${sessionId}, going directly to recording`);
      }

      // Log the XML response being sent
      logger.info(`🎤 SENDING LANGUAGE SELECTION RESPONSE:`);
      logger.info(responseXML);

      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling language selection:', error);
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse());
    }
  }
  
  handleRecording = async (req: Request, res: Response): Promise<void> => {
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
          sessionManager.updateSessionContext(sessionId, {
            recordingUrl: recording,
            recordingDuration: callRecordingDurationInSeconds
          });
        }
        res.status(200).send('');
        return;
      }

      // Get session language IMMEDIATELY for appropriate voice
      const session = sessionManager.getSession(sessionId);
      const sessionLanguage = (session?.context?.language || session?.language || 'en') as 'en' | 'yo' | 'ha';

      // Check if we have a recording URL
      if (!recording) {
        logger.warn(`⚠️ No recording URL received for session: ${sessionId}`);
        // Return error and ask to try again
        const errorMessage = this.getNoRecordingMessage(sessionLanguage);
        const errorXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(errorMessage, sessionLanguage)}
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>
</Response>`;
        res.set('Content-Type', 'application/xml');
        res.send(errorXML);
        return;
      }

      // Store recording URL for immediate processing
      sessionManager.updateSessionContext(sessionId, {
        recordingUrl: recording,
        recordingDuration: callRecordingDurationInSeconds
      });

      // Process recording synchronously - no background processing or redirects
      logger.info(`🚀 Processing recording synchronously for session: ${sessionId}`);
      const startTime = Date.now();

      try {
        // 1. Transcribe audio
        logger.info(`⚡ Starting transcription for session ${sessionId}`);
        const farmerText = await aiService.transcribeAudio(recording);
        const transcriptionTime = Date.now() - startTime;
        logger.info(`⚡ Transcription completed in ${transcriptionTime}ms: "${farmerText}"`);

        // 2. Store transcription
        sessionManager.updateSessionContext(sessionId, { transcription: farmerText });

        // 3. Process with AI
        logger.info(`⚡ Starting AI processing for session ${sessionId}`);
        const aiStartTime = Date.now();
        const aiResponse = await aiService.processVeterinaryQuery(farmerText, {
          menu: 'veterinary_ai',
          farmerId: sessionId,
          language: sessionLanguage
        });
        const aiTime = Date.now() - aiStartTime;
        logger.info(`⚡ AI processing completed in ${aiTime}ms`);

        // 4. Clean and truncate response
        const cleanedResponse = this.cleanAIResponse(aiResponse.response);
        const truncatedResponse = this.truncateForAudio(cleanedResponse);
        logger.info(`📝 Truncated AI response from ${cleanedResponse.length} to ${truncatedResponse.length} characters`);

        // 5. Store AI interaction
        sessionManager.addAIInteraction(sessionId, farmerText, truncatedResponse, 0.9, 'veterinary');
        sessionManager.updateSessionContext(sessionId, {
          aiResponse: truncatedResponse,
          aiReady: true
        });

        // 6. Generate complete response with processing message + AI answer + post-AI menu
        const processingMessage = this.getProcessingMessage(sessionLanguage);
        const processingAudio = await this.generateLanguageSpecificSay(processingMessage, sessionLanguage);
        const audioTag = await this.generateLanguageSpecificSay(truncatedResponse, sessionLanguage);
        
        const postAIPrompt = sessionLanguage === 'en' ? 
          "Do you have any other concerns? Press 1 to ask another question, press 2 to speak with a human expert, press 3 to go back to main menu, or press 0 to end the call." :
          sessionLanguage === 'yo' ?
          "Ṣé ẹ ní ìṣòro mìíràn? Ẹ tẹ́ ọ̀kan láti béèrè ìbéèrè mìíràn, ẹ tẹ́ méjì láti bá amọ̀ràn sọ̀rọ̀, ẹ tẹ́ mẹ́ta láti padà sí àtòjọ àkọ́kọ́, tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà." :
          "Kana da wasu matsaloli? Danna 1 don yin wata tambaya, danna 2 don magana da ƙwararren likita, danna 3 don komawa babban menu, ko danna 0 don kammala kiran.";
        
        const postAIAudio = await this.generateLanguageSpecificSay(postAIPrompt, sessionLanguage);
        const noInputMessage = await this.generateLanguageSpecificSay("We did not receive your selection. Let me repeat the options.", sessionLanguage);
        
        const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${processingAudio}
  ${audioTag}
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai?language=${sessionLanguage}">
    ${postAIAudio}
  </GetDigits>
  ${noInputMessage}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?language=${sessionLanguage}</Redirect>
</Response>`;

        const totalTime = Date.now() - startTime;
        logger.info(`⚡ Synchronous processing completed in ${totalTime}ms (Transcription: ${transcriptionTime}ms, AI: ${aiTime}ms)`);
        logger.info(`🎤 SENDING COMPLETE AI RESPONSE:`);
        logger.info(responseXML);
        
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);

      } catch (processingError) {
        logger.error(`Error in synchronous processing for session ${sessionId}:`, processingError);
        // Send error response if processing fails
        const errorMessage = sessionLanguage === 'en' ? 
          "I'm sorry, there was an error processing your request. Please try again." :
          sessionLanguage === 'yo' ?
          "Má bínú, àṣìṣe wà nínú ṣíṣe ìbéèrè yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si." :
          "Yi hakuri, an sami kuskure wajen aiwatar da buƙatarku. Don Allah ku sake gwadawa.";
        
        const errorXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(errorMessage, sessionLanguage)}
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>
</Response>`;
        
        res.set('Content-Type', 'application/xml');
        res.send(errorXML);
      }

    } catch (error) {
      logger.error('💥 ERROR handling recording:', error);
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse());
    }
  }


  handlePostAI = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;
      const languageParam = req.query.language as string || 'en';
      
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
        const responseXML = await africasTalkingService.generatePostAIMenuResponse(languageParam);
        
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }
      
      // Handle user's choice
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);
      let responseXML = '';
      const language = languageParam as 'en' | 'yo' | 'ha';
      
      switch (choice) {
        case 1: // Ask another question - use follow-up recording (no language selection message)
          responseXML = await africasTalkingService.generateFollowUpRecordingResponse(language);
          break;
          
        case 2: // Speak with human expert
          responseXML = await africasTalkingService.generateTransferResponse(language);
          break;
          
        case 3: // Go back to main menu
          responseXML = await africasTalkingService.generateWelcomeResponse();
          break;
          
        case 0: // End call
          const endGoodbyeMessage = this.getGoodbyeMessage(language);
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(endGoodbyeMessage, language)}
</Response>`;
          break;
          
        default:
          // Invalid choice - repeat the menu
          responseXML = await africasTalkingService.generatePostAIMenuResponse(language);
      }
      
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);
      
    } catch (error) {
      logger.error('Error handling post-AI:', error);
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse());
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

  /**
   * Truncate AI response to prevent large audio files that cause AT timeouts
   */
  private truncateForAudio(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    if (lastSentenceEnd > 0) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // If no sentence boundary found, just truncate and add period
    return truncated.trim() + '.';
  }

  /**
   * Generate language-specific Say tag using TTS when available, fallback to default voice
   */
  private async generateLanguageSpecificSay(text: string, language: 'en' | 'yo' | 'ha'): Promise<string> {
    try {
      // Try to generate TTS audio with appropriate voice for the language
      const audioUrl = await africasTalkingService.generateTTSAudio(text, language);
      if (audioUrl) {
        return `<Play url="${audioUrl}"/>`;
      }
    } catch (error) {
      logger.warn(`Failed to generate TTS for language ${language}, falling back to Say tag:`, error);
    }
    
    // Fallback to Say tag
    return `<Say voice="woman">${text}</Say>`;
  }



  /**
   * Get no-recording error message in appropriate language
   */
  private getNoRecordingMessage(language: 'en' | 'yo' | 'ha'): string {
    const messages = {
      en: "I didn't hear your recording. Please try again and speak after the beep.",
      yo: "Mi ò gbọ́ ìgbóhùn yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si, kí ẹ sì sọ̀rọ̀ lẹ́yìn ìró àlámọ́.",
      ha: "Ban ji rikodin ku ba. Don Allah ku sake gwadawa kuma ku yi magana bayan sautin."
    };
    return messages[language] || messages.en;
  }

  /**
   * Get processing message in appropriate language
   */
  private getProcessingMessage(language: 'en' | 'yo' | 'ha'): string {
    const messages = {
      en: "Thank you for your question. Agrocist is analyzing your concern.",
      yo: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín.",
      ha: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku."
    };
    return messages[language] || messages.en;
  }

  /**
   * Get goodbye message in appropriate language
   */
  private getGoodbyeMessage(language: 'en' | 'yo' | 'ha'): string {
    const messages = {
      en: "Thank you for using Agrocist. Have a great day!",
      yo: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      ha: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!"
    };
    return messages[language] || messages.en;
  }
  
}

export default new VoiceController();