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
  <Hangup/>
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

      // Start AI processing in the background IMMEDIATELY (don't await)
      logger.info(`🚀 Starting background AI processing for session: ${sessionId}`);
      this.processRecordingInBackground(sessionId, recording, sessionLanguage).catch(err => {
        logger.error(`Background processing failed for session ${sessionId}:`, err);
        // Mark error in session so handleAIProcessing knows
        sessionManager.updateSessionContext(sessionId, { processingError: true });
      });

      // Send immediate processing message while AI works in background
      const processingMessage = this.getProcessingMessage(sessionLanguage);
      logger.info(`📢 Processing message text: "${processingMessage}"`);

      const audioTag = await this.generateLanguageSpecificSay(processingMessage, sessionLanguage);
      logger.info(`📢 Processing audio tag: ${audioTag.substring(0, 100)}...`);

      const processingXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioTag}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      logger.info(`🎤 SENDING PROCESSING MESSAGE:`);
      logger.info(processingXML);
      res.set('Content-Type', 'application/xml');
      res.send(processingXML);

    } catch (error) {
      logger.error('💥 ERROR handling recording:', error);
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse());
    }
  }

  /**
   * Process recording in background for maximum speed
   * Starts transcription and AI processing immediately without blocking the response
   */
  private async processRecordingInBackground(sessionId: string, recordingUrl: string, language: 'en' | 'yo' | 'ha'): Promise<void> {
    try {
      const startTime = Date.now();

      // Start transcription immediately
      logger.info(`⚡ Starting transcription for session ${sessionId}`);
      const farmerText = await aiService.transcribeAudio(recordingUrl);
      const transcriptionTime = Date.now() - startTime;
      logger.info(`⚡ Transcription completed in ${transcriptionTime}ms: "${farmerText}"`);

      // Store transcription
      sessionManager.updateSessionContext(sessionId, { transcription: farmerText });

      // Process with AI immediately (in parallel if possible)
      logger.info(`⚡ Starting AI processing for session ${sessionId}`);
      const aiStartTime = Date.now();
      const aiResponse = await aiService.processVeterinaryQuery(farmerText, {
        menu: 'veterinary_ai',
        farmerId: sessionId,
        language: language
      });
      const aiTime = Date.now() - aiStartTime;
      logger.info(`⚡ AI processing completed in ${aiTime}ms`);

      // Clean the AI response
      const cleanedResponse = this.cleanAIResponse(aiResponse.response);

      // Pre-generate TTS audio for the response (parallel with storage)
      logger.info(`⚡ Starting TTS generation for session ${sessionId}`);
      const ttsStartTime = Date.now();
      const ttsPromise = africasTalkingService.generateTTSAudio(cleanedResponse, language);

      // Store AI interaction while TTS generates
      sessionManager.addAIInteraction(sessionId, farmerText, cleanedResponse, 0.9, 'veterinary');
      sessionManager.updateSessionContext(sessionId, {
        aiResponse: cleanedResponse,
        aiReady: true
      });

      // Wait for TTS to complete
      await ttsPromise;
      const ttsTime = Date.now() - ttsStartTime;
      const totalTime = Date.now() - startTime;

      logger.info(`⚡ Background processing completed in ${totalTime}ms (Transcription: ${transcriptionTime}ms, AI: ${aiTime}ms, TTS: ${ttsTime}ms)`);

    } catch (error) {
      logger.error(`Error in background processing for session ${sessionId}:`, error);
      // Store error state so handleAIProcessing can handle it
      sessionManager.updateSessionContext(sessionId, { processingError: true });
    }
  }

  handlePostAI = async (req: Request, res: Response): Promise<void> => {
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
        const session = sessionManager.getSession(sessionId);
        const language = languageParam || session?.context?.language || 'en';
        const responseXML = await africasTalkingService.generatePostAIMenuResponse(language);
        
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }
      
      // Handle user's choice
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);
      let responseXML = '';
      
      switch (choice) {
        case 1: // Speak with human expert
          responseXML = await africasTalkingService.generateTransferResponse();
          break;
          
        case 0: // End call
          const endSession = sessionManager.getSession(sessionId);
          const endLanguage = (languageParam || endSession?.context?.language || 'en') as 'en' | 'yo' | 'ha';
          const endGoodbyeMessage = this.getGoodbyeMessage(endLanguage);
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(endGoodbyeMessage, endLanguage)}
  <Hangup/>
</Response>`;
          break;
          
        default:
          // Get session to determine language for repeat prompt
          const defaultSession = sessionManager.getSession(sessionId);
          const language = languageParam || defaultSession?.context?.language || 'en';
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
  
  handleAIProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session as string;
      const webhookData = req.body as AfricasTalkingWebhook;
      const { isActive } = webhookData;

      logger.info(`🤖 CHECKING AI RESULTS for session: ${sessionId}, isActive: ${isActive}`);

      // If call is not active, just return empty response
      if (isActive === "0") {
        logger.info(`❌ Call ended for session: ${sessionId}, returning empty response`);
        res.status(200).send('');
        return;
      }

      // Get session data
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        logger.error(`No session found: ${sessionId}`);
        res.set('Content-Type', 'application/xml');
        res.send(await africasTalkingService.generateErrorResponse());
        return;
      }

      const language = (session.context.language || session.language || 'en') as 'en' | 'yo' | 'ha';

      // Check if processing encountered an error
      if (session.context.processingError) {
        logger.error(`Processing error detected for session: ${sessionId}`);
        res.set('Content-Type', 'application/xml');
        res.send(await africasTalkingService.generateErrorResponse(language));
        return;
      }

      // Check if AI response is ready (from background processing)
      if (session.context.aiReady && session.context.aiResponse) {
        logger.info(`✅ AI response already ready for session ${sessionId}`);
        const cleanedResponse = session.context.aiResponse;

        // Generate the language-specific audio/say tag
        logger.info(`🔊 Generating audio tag for language: ${language}, text: ${cleanedResponse.substring(0, 50)}...`);
        const audioTag = await this.generateLanguageSpecificSay(cleanedResponse, language);
        logger.info(`🔊 Generated audio tag: ${audioTag.substring(0, 100)}...`);

        // Generate response with AI answer and redirect to post-AI menu
        const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioTag}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?session=${sessionId}&language=${language}</Redirect>
</Response>`;

        logger.info(`🎤 SENDING CACHED AI RESPONSE XML:`);
        logger.info(responseXML);
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }

      // If not ready yet, wait a bit and redirect back (polling approach)
      logger.info(`⏳ AI still processing for session ${sessionId}, redirecting...`);
      const waitMessage = this.getWaitMessage(language);
      const redirectXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(waitMessage, language)}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      res.set('Content-Type', 'application/xml');
      res.send(redirectXML);

    } catch (error) {
      logger.error('💥 ERROR processing AI request:', error);
      const session = sessionManager.getSession(req.query.session as string);
      const lang = (session?.context?.language || session?.language || 'en') as 'en' | 'yo' | 'ha';
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse(lang));
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
   * Get processing message in appropriate language
   */
  private getProcessingMessage(language: 'en' | 'yo' | 'ha'): string {
    const messages = {
      en: "Thank you for your question. Agrocist is analyzing your concern. Please wait a moment for your response.",
      yo: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín. Ẹ dúró díẹ̀ fún ìdáhùn yín.",
      ha: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku. Don Allah ku jira na ɗan lokaci don amsar ku."
    };
    return messages[language] || messages.en;
  }

  /**
   * Get wait message in appropriate language (for polling)
   */
  private getWaitMessage(language: 'en' | 'yo' | 'ha'): string {
    const messages = {
      en: "Just a moment, processing your request.",
      yo: "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín.",
      ha: "Don Allah ku ɗan jira, muna aiwatar da buƙatarku."
    };
    return messages[language] || messages.en;
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