import { Request, Response } from 'express';
import { AfricasTalkingWebhook } from '../types';
import africasTalkingService from '../services/africasTalkingService';
import aiService from '../services/aiService';
import sessionManager from '../utils/sessionManager';
import logger from '../utils/logger';
import config from '../config';
import engagementService from '../services/engagementService';
import { IVRState, TerminationReason } from '../models/EngagementMetrics';

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

        // Track call termination if we have sessionId
        if (sessionId && callerNumber) {
          try {
            const terminationReason = this.determineTerminationReason(callEndReason, durationInSeconds);
            const completed = terminationReason === TerminationReason.COMPLETED_SUCCESSFULLY;
            await engagementService.endSession(sessionId, terminationReason, completed);
          } catch (error) {
            logger.warn('Failed to track call termination:', error);
          }
        }

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

        // Start engagement tracking
        try {
          const engagementSessionId = await engagementService.startSession(
            callerNumber, 
            sessionId,
            req.get('User-Agent'),
            req.ip
          );
          
          // Track initial state transition to welcome
          await engagementService.trackStateTransition(engagementSessionId, IVRState.WELCOME);
          
          // Store engagement session ID for later use
          sessionManager.updateSessionContext(sessionId, { engagementSessionId });
        } catch (error) {
          logger.warn('Failed to start engagement tracking:', error);
        }
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

        // Track termination in language selection
        try {
          const session = sessionManager.getSession(sessionId);
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.endSession(engagementSessionId, TerminationReason.USER_HANGUP);
          }
        } catch (error) {
          logger.warn('Failed to track language selection termination:', error);
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
            
          case 4: // Igbo (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = 'ig';
              responseXML = await africasTalkingService.generateDirectRecordingResponse('ig');
            } else {
              logger.warn(`TTS unavailable, rejecting Igbo choice for session: ${sessionId}`);
              responseXML = await africasTalkingService.generateLanguageMenuResponse();
            }
            break;
            
          case 5: // Repeat menu
            responseXML = await africasTalkingService.generateLanguageMenuResponse();
            break;
            
          case 0: // End call
            const goodbyeMessage = this.getGoodbyeMessage(selectedLanguage as 'en' | 'yo' | 'ha' | 'ig');
            responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(goodbyeMessage, selectedLanguage as 'en' | 'yo' | 'ha' | 'ig')}
</Response>`;
            break;
            
          default:
            logger.warn(`Invalid language choice: ${choice} for session: ${sessionId}`);
            responseXML = await africasTalkingService.generateLanguageMenuResponse();
        }
      }
      
      // Store selected language in session if valid choice - both in context AND at session level
      if (typeof choice === 'number' && [1, 2, 3, 4].includes(choice)) {
        // Update in both places for maximum persistence
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.language = selectedLanguage as 'en' | 'yo' | 'ha' | 'ig';
          sessionManager.saveSession(session);
        }
        sessionManager.updateSessionContext(sessionId, { language: selectedLanguage });
        sessionManager.updateSessionMenu(sessionId, 'recording');
        logger.info(`✅ Language ${selectedLanguage} LOCKED for session: ${sessionId}, going directly to recording`);

        // Track language selection
        try {
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.trackLanguageSelection(engagementSessionId, selectedLanguage as 'en' | 'yo' | 'ha' | 'ig');
            await engagementService.trackStateTransition(
              engagementSessionId, 
              IVRState.RECORDING_PROMPT, 
              dtmfDigits || choice.toString()
            );
          }
        } catch (error) {
          logger.warn('Failed to track language selection:', error);
        }
      } else if (choice === 0) {
        // Track call end choice
        try {
          const session = sessionManager.getSession(sessionId);
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.endSession(engagementSessionId, TerminationReason.COMPLETED_SUCCESSFULLY, true);
          }
        } catch (error) {
          logger.warn('Failed to track call end choice:', error);
        }
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

        // Track termination during recording
        try {
          const session = sessionManager.getSession(sessionId);
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.endSession(engagementSessionId, TerminationReason.USER_HANGUP);
          }
        } catch (error) {
          logger.warn('Failed to track recording termination:', error);
        }

        res.status(200).send('');
        return;
      }

      // Get session language IMMEDIATELY for appropriate voice
      const session = sessionManager.getSession(sessionId);
      const sessionLanguage = (session?.context?.language || session?.language || 'en') as 'en' | 'yo' | 'ha' | 'ig';

      // Check if we have a recording URL
      if (!recording) {
        logger.warn(`⚠️ No recording URL received for session: ${sessionId}`);
        // Return error and ask to try again
        const errorXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateStaticAudioSay('noRecording', sessionLanguage)}
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

      // Track recording state transition
      try {
        const engagementSessionId = session?.context?.engagementSessionId;
        if (engagementSessionId) {
          await engagementService.trackStateTransition(engagementSessionId, IVRState.RECORDING_IN_PROGRESS);
          await engagementService.trackStateTransition(engagementSessionId, IVRState.AI_PROCESSING);
        }
      } catch (error) {
        logger.warn('Failed to track recording states:', error);
      }

      // Optimized approach: immediate processing + extended processing message
      logger.info(`🚀 Starting optimized processing for session: ${sessionId}`);
      
      // Start background processing immediately (don't await)
      this.processRecordingInBackground(sessionId, recording, sessionLanguage).catch(err => {
        logger.error(`Background processing failed for session ${sessionId}:`, err);
        sessionManager.updateSessionContext(sessionId, { processingError: true });
      });

      // Respond with extended processing message to give AI time to complete
      const processingAudio = await this.generateStaticAudioSay('processing', sessionLanguage);
      const waitAudio = await this.generateStaticAudioSay('wait', sessionLanguage);
      
      const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${processingAudio}
  ${waitAudio}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      logger.info(`🎤 SENDING IMMEDIATE PROCESSING RESPONSE:`);
      logger.info(responseXML);
      res.set('Content-Type', 'application/xml');
      res.send(responseXML);

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
        
        // Track termination in post-AI
        try {
          const session = sessionManager.getSession(sessionId);
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.endSession(engagementSessionId, TerminationReason.USER_HANGUP);
          }
        } catch (error) {
          logger.warn('Failed to track post-AI termination:', error);
        }

        res.status(200).send('');
        return;
      }

      // If no DTMF digits, this is the initial redirect - show the post-AI menu
      if (!dtmfDigits) {
        // Track state transition to post-AI menu
        try {
          const session = sessionManager.getSession(sessionId);
          const engagementSessionId = session?.context?.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.trackStateTransition(engagementSessionId, IVRState.POST_AI_MENU);
          }
        } catch (error) {
          logger.warn('Failed to track post-AI menu state:', error);
        }

        const responseXML = await africasTalkingService.generatePostAIMenuResponse(languageParam);
        
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }
      
      // Handle user's choice
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);
      let responseXML = '';
      const language = languageParam as 'en' | 'yo' | 'ha' | 'ig';
      
      // Track post-AI menu choice
      try {
        const session = sessionManager.getSession(sessionId);
        const engagementSessionId = session?.context?.engagementSessionId;
        if (engagementSessionId) {
          switch (choice) {
            case 1:
              await engagementService.trackStateTransition(
                engagementSessionId, 
                IVRState.FOLLOW_UP_RECORDING, 
                dtmfDigits
              );
              break;
            case 2:
              await engagementService.trackAgentTransfer(engagementSessionId);
              await engagementService.trackStateTransition(
                engagementSessionId, 
                IVRState.HUMAN_AGENT_TRANSFER, 
                dtmfDigits
              );
              break;
            case 3:
              await engagementService.trackStateTransition(
                engagementSessionId, 
                IVRState.WELCOME, 
                dtmfDigits
              );
              break;
            case 0:
              await engagementService.endSession(engagementSessionId, TerminationReason.COMPLETED_SUCCESSFULLY, true);
              break;
          }
        }
      } catch (error) {
        logger.warn('Failed to track post-AI choice:', error);
      }

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
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateStaticAudioSay('goodbye', language)}
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
    // Complete text processing for audio delivery
    return response
      // Remove markdown formatting
      .replace(/\*\*/g, '') // Remove bold markdown
      .replace(/\*/g, '')   // Remove italic markdown
      .replace(/##\s*/g, '') // Remove heading markdown
      .replace(/#\s*/g, '')  // Remove heading markdown
      
      // Handle measurements and abbreviations
      .replace(/Dr\./g, 'Doctor')
      .replace(/(\d+)\s*mg/g, '$1 milligrams')
      .replace(/(\d+)\s*ml/g, '$1 milliliters')
      .replace(/(\d+)\s*kg/g, '$1 kilograms')
      .replace(/(\d+)°C/g, '$1 degrees Celsius')
      
      // Clean up line breaks and spacing
      .replace(/\n\s*[\d\-\*]\.\s*/g, '. ') // Convert numbered/bulleted lists to sentences
      .replace(/\n\s*[\-\*]\s*/g, '. ') // Convert bullet points to sentences
      .replace(/\n\s*\n/g, '. ') // Replace double newlines with period
      .replace(/\n/g, ' ') // Replace single newlines with space
      
      // Clean up punctuation
      .replace(/\.\s*\./g, '.') // Remove double periods
      .replace(/\s*:\s*/g, ': ') // Clean up colons
      .replace(/\s+/g, ' ') // Remove extra spaces
      .replace(/\s+\./g, '.') // Remove spaces before periods
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
  private async generateLanguageSpecificSay(text: string, language: 'en' | 'yo' | 'ha' | 'ig'): Promise<string> {
    try {
      // This is for dynamic AI responses only - static messages use staticAudioService directly
      const audioUrl = await africasTalkingService.generateTTSAudio(text, language);
      if (audioUrl) {
        return `<Play url="${audioUrl}"/>`;
      }
    } catch (error) {
      logger.warn(`Failed to generate TTS for language ${language}, falling back to Say tag:`, error);
    }
    
    // Fallback to Say tag
    return `<Say voice="woman">${this.escapeXML(text)}</Say>`;
  }

  /**
   * Generate static audio using pre-generated files
   */
  private async generateStaticAudioSay(textKey: 'welcome' | 'processing' | 'error' | 'goodbye' | 'noRecording' | 'wait' | 'directRecording' | 'followUpRecording' | 'postAIMenu' | 'noInputMessage' | 'transfer', language: 'en' | 'yo' | 'ha' | 'ig'): Promise<string> {
    try {
      // First try to get pre-generated static audio
      const staticAudioService = (await import('../services/staticAudioService')).default;
      const audioUrl = staticAudioService.getStaticAudioUrl(language, textKey);
      
      if (audioUrl) {
        logger.info(`🎵 Using pre-generated static audio for ${language}_${textKey}`);
        return `<Play url="${audioUrl}"/>`;
      } else {
        logger.warn(`⚠️ No pre-generated audio for ${language}_${textKey}, generating dynamically`);
        const text = staticAudioService.getStaticText(language, textKey);
        return await this.generateLanguageSpecificSay(text, language);
      }
    } catch (error) {
      logger.error(`Error generating static audio for ${language}_${String(textKey)}:`, error);
      // Fallback to basic Say tag
      return `<Say voice="woman">System message</Say>`;
    }
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }



  /**
   * Get no-recording error message in appropriate language
   */
  private getNoRecordingMessage(language: 'en' | 'yo' | 'ha' | 'ig'): string {
    const messages = {
      en: "I didn't hear your recording. Please try again and speak after the beep.",
      yo: "Mi ò gbọ́ ìgbóhùn yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si, kí ẹ sì sọ̀rọ̀ lẹ́yìn ìró àlámọ́.",
      ha: "Ban ji rikodin ku ba. Don Allah ku sake gwadawa kuma ku yi magana bayan sautin.",
      ig: "Anụghị m ndekọ gị. Biko gbalịa ọzọ ma kwuo okwu mgbe ụda ahụ gasịrị."
    };
    return messages[language] || messages.en;
  }

  /**
   * Get processing message in appropriate language
   */
  private getProcessingMessage(language: 'en' | 'yo' | 'ha' | 'ig'): string {
    const messages = {
      en: "Thank you for your question. Agrocist is analyzing your concern.",
      yo: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín.",
      ha: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku.",
      ig: "Daalụ maka ajụjụ gị. Agrocist na-enyocha nsogbu gị."
    };
    return messages[language] || messages.en;
  }

  /**
   * Get goodbye message in appropriate language
   */
  private getGoodbyeMessage(language: 'en' | 'yo' | 'ha' | 'ig'): string {
    const messages = {
      en: "Thank you for using Agrocist. Have a great day!",
      yo: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      ha: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
      ig: "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!"
    };
    return messages[language] || messages.en;
  }

  /**
   * Process recording in background for speed - no TTS generation to avoid delays
   */
  private async processRecordingInBackground(sessionId: string, recordingUrl: string, language: 'en' | 'yo' | 'ha' | 'ig'): Promise<void> {
    try {
      const startTime = Date.now();

      // 1. Transcribe audio
      logger.info(`⚡ Starting transcription for session ${sessionId}`);
      const farmerText = await aiService.transcribeAudio(recordingUrl);
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
        language: language
      });
      const aiTime = Date.now() - aiStartTime;
      logger.info(`⚡ AI processing completed in ${aiTime}ms`);

      // 4. Clean and truncate response
      const cleanedResponse = this.cleanAIResponse(aiResponse.response);
      const truncatedResponse = this.truncateForAudio(cleanedResponse);
      logger.info(`📝 Truncated AI response from ${cleanedResponse.length} to ${truncatedResponse.length} characters`);

      // 5. Store AI interaction and mark as ready (no TTS pre-generation to avoid delays)
      sessionManager.addAIInteraction(sessionId, farmerText, truncatedResponse, 0.9, 'veterinary');
      sessionManager.updateSessionContext(sessionId, {
        aiResponse: truncatedResponse,
        aiReady: true
      });

      // 7. Track AI interaction in engagement metrics
      try {
        const session = sessionManager.getSession(sessionId);
        const engagementSessionId = session?.context?.engagementSessionId;
        const recordingDuration = session?.context?.recordingDuration || 0;
        
        if (engagementSessionId) {
          await engagementService.trackAIInteraction(
            engagementSessionId,
            recordingDuration,
            farmerText,
            truncatedResponse,
            aiTime,
            0, // TTS generation time (we generate it later)
            aiResponse.confidence
          );
        }
      } catch (error) {
        logger.warn('Failed to track AI interaction:', error);
      }

      const totalTime = Date.now() - startTime;
      logger.info(`⚡ Background processing completed in ${totalTime}ms (Transcription: ${transcriptionTime}ms, AI: ${aiTime}ms)`);

    } catch (error) {
      logger.error(`Error in background processing for session ${sessionId}:`, error);
      sessionManager.updateSessionContext(sessionId, { processingError: true });
      
      // Track processing error
      try {
        const session = sessionManager.getSession(sessionId);
        const engagementSessionId = session?.context?.engagementSessionId;
        if (engagementSessionId) {
          await engagementService.trackError(
            engagementSessionId,
            `AI processing error: ${error instanceof Error ? error.message : String(error)}`,
            IVRState.AI_PROCESSING,
            'high'
          );
        }
      } catch (trackingError) {
        logger.warn('Failed to track processing error:', trackingError);
      }
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

      const language = (session.context.language || session.language || 'en') as 'en' | 'yo' | 'ha' | 'ig';

      // Check if processing encountered an error
      if (session.context.processingError) {
        logger.error(`Processing error detected for session: ${sessionId}`);
        res.set('Content-Type', 'application/xml');
        res.send(await africasTalkingService.generateErrorResponse(language));
        return;
      }

      // Check if AI response is ready
      if (session.context.aiReady && session.context.aiResponse) {
        logger.info(`✅ AI response ready for session ${sessionId}`);
        const aiResponse = session.context.aiResponse;

        // Track state transition to AI response
        try {
          const engagementSessionId = session.context.engagementSessionId;
          if (engagementSessionId) {
            await engagementService.trackStateTransition(engagementSessionId, IVRState.AI_RESPONSE);
          }
        } catch (error) {
          logger.warn('Failed to track AI response state:', error);
        }

        // Generate TTS audio for AI response
        const audioTag = await this.generateLanguageSpecificSay(aiResponse, language);
        
        const postAIPrompt = language === 'en' ? 
          "Press 1 for another question or press 0 to end the call." :
          language === 'yo' ?
          "Ẹ tẹ́ ọ̀kan fún ìbéèrè mìíràn tàbí ẹ tẹ́ ọ̀fà láti parí ìpè náà." :
          language === 'ha' ?
          "Danna 1 don wata tambaya ko danna 0 don kammala kiran." :
          "Pịa 1 maka ajụjụ ọzọ ma ọ bụ pịa 0 iji kwụsị oku a.";
        
        const postAIAudio = await this.generateLanguageSpecificSay(postAIPrompt, language);
        const noInputMessage = await this.generateLanguageSpecificSay("We did not receive your selection. Let me repeat the options.", language);
        
        const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioTag}
  <GetDigits timeout="2" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai?language=${language}">
    ${postAIAudio}
  </GetDigits>
  ${noInputMessage}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?language=${language}</Redirect>
</Response>`;

        logger.info(`🎤 SENDING AI RESPONSE XML:`);
        logger.info(responseXML);
        res.set('Content-Type', 'application/xml');
        res.send(responseXML);
        return;
      }

      // If not ready yet, give a shorter wait and redirect back quickly
      logger.info(`⏳ AI still processing for session ${sessionId}, redirecting quickly...`);
      const redirectXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      res.set('Content-Type', 'application/xml');
      res.send(redirectXML);

    } catch (error) {
      logger.error('💥 ERROR processing AI request:', error);
      const session = sessionManager.getSession(req.query.session as string);
      const lang = (session?.context?.language || session?.language || 'en') as 'en' | 'yo' | 'ha' | 'ig';
      res.set('Content-Type', 'application/xml');
      res.send(await africasTalkingService.generateErrorResponse(lang));
    }
  }

  /**
   * Get wait message in appropriate language (for polling)
   */
  private getWaitMessage(language: 'en' | 'yo' | 'ha' | 'ig'): string {
    const messages = {
      en: "Just a moment, processing your request.",
      yo: "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín.",
      ha: "Don Allah ku ɗan jira, muna aiwatar da buƙatarku.",
      ig: "Chere ntakịrị, anyị na-edozi ihe ị chọrọ."
    };
    return messages[language] || messages.en;
  }

  /**
   * Determine termination reason based on call data
   */
  private determineTerminationReason(callEndReason?: string, duration?: number): TerminationReason {
    if (!duration || duration < 5) {
      return TerminationReason.NETWORK_ISSUE;
    }
    
    if (callEndReason) {
      const reason = callEndReason.toLowerCase();
      if (reason.includes('timeout')) {
        return TerminationReason.TIMEOUT;
      }
      if (reason.includes('error') || reason.includes('failed')) {
        return TerminationReason.SYSTEM_ERROR;
      }
      if (reason.includes('completed') || reason.includes('success')) {
        return TerminationReason.COMPLETED_SUCCESSFULLY;
      }
    }
    
    // Default to user hangup if duration is reasonable
    return TerminationReason.USER_HANGUP;
  }
  
}

export default new VoiceController();