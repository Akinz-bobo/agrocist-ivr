import { Request, Response } from "express";
import { AfricasTalkingWebhook } from "../types";
import africasTalkingService from "../services/africasTalkingService";
import aiService from "../services/aiService";
import sessionManager from "../utils/sessionManager";
import logger from "../utils/logger";
import config from "../config";
import engagementService from "../services/engagementService";
import { IVRState, TerminationReason } from "../models/EngagementMetrics";

class VoiceController {
  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    try {
      // Africa's Talking sends form data - extract from req.body
      const webhookData = req.body as any;
      logger.info(`=== INCOMING WEBHOOK REQUEST ===`);
      logger.info(`Content-Type: ${req.get("Content-Type")}`);
      logger.info(`Method: ${req.method}`);
      logger.info(`URL: ${req.url}`);
      logger.info(`Headers:`, req.headers);
      logger.info(
        `Full webhook data received:`,
        JSON.stringify(webhookData, null, 2)
      );

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
        recordingUrl,
        callRecordingDurationInSeconds,
      } = webhookData;

      // LOG CALLER INFORMATION
      logger.info('📞 === CALLER INFORMATION ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Caller Number: ${callerNumber}`);
      logger.info(`Destination Number: ${destinationNumber}`);
      logger.info(`Direction: ${direction}`);
      logger.info(`Call Type: ${callType}`);
      logger.info(`Is Active: ${isActive}`);
      logger.info(`Call Status: ${callStatus || call_status || 'N/A'}`);
      logger.info(`Call Start Time: ${callStartTime || 'N/A'}`);
      logger.info(`Call End Time: ${callEndTime || 'N/A'}`);
      logger.info(`Duration (seconds): ${durationInSeconds || callDurationInSeconds || 'N/A'}`);
      logger.info(`Call End Reason: ${callEndReason || 'N/A'}`);
      logger.info(`Recording URL: ${callRecordingUrl || recordingUrl || 'N/A'}`);
      logger.info(`Recording Duration: ${callRecordingDurationInSeconds || 'N/A'}`);

      // LOG ALL ADDITIONAL AFRICA'S TALKING DATA
      logger.info('📊 === ALL WEBHOOK FIELDS ===');
      Object.keys(webhookData).forEach(key => {
        logger.info(`${key}: ${webhookData[key]}`);
      });
      logger.info('=== END WEBHOOK DATA ===');

      logger.info(
        `PARSED DATA - Session: ${sessionId}, Active: ${isActive}, Caller: ${callerNumber}, Destination: ${destinationNumber}, Duration: ${durationInSeconds}s`
      );

      // CRITICAL: Follow exact Python pattern - if isActive is "0", return empty response
      if (isActive === "0") {
        logger.info(
          "❌ CALL COMPLETION EVENT (isActive=0) - returning empty response.",
          {
            sessionId,
            callerNumber,
            duration: durationInSeconds,
            callStatus: callStatus || call_status,
          }
        );

        // Flush buffered engagement data to database when call ends
        if (sessionId && callerNumber) {
          const session = sessionManager.getSession(sessionId);
          if (session && session.engagementBuffer) {
            const terminationReason = this.determineTerminationReason(
              callEndReason,
              durationInSeconds
            );
            const completed =
              terminationReason === TerminationReason.COMPLETED_SUCCESSFULLY;

            // Set termination info
            sessionManager.setTerminationInfo(
              sessionId,
              terminationReason,
              completed
            );
            sessionManager.bufferStateTransition(
              sessionId,
              session.engagementBuffer.currentState || IVRState.CALL_ENDED,
              IVRState.CALL_ENDED
            );

            // LOG COMPLETE CALL SUMMARY
            logger.info('📋 === CALL SUMMARY ===');
            logger.info(`Session ID: ${sessionId}`);
            logger.info(`Caller Number: ${callerNumber}`);
            logger.info(`Language: ${session.language || session.engagementBuffer.selectedLanguage || 'N/A'}`);
            logger.info(`Duration: ${durationInSeconds || 'N/A'} seconds`);

            // Log each AI interaction in simple format
            const interactions = session.engagementBuffer.aiInteractionsDetailed || [];
            logger.info(`Total Interactions: ${interactions.length}`);
            if (interactions.length > 0) {
              logger.info('💬 Interactions:');
              interactions.forEach((interaction: any, index: number) => {
                logger.info(`  [${index + 1}] User Query: "${interaction.userQuery}"`);
                logger.info(`      AI Response: "${interaction.aiResponse}"`);
              });
            }

            logger.info('=== END CALL SUMMARY ===');

            // Flush to database in background (non-blocking)
            logger.info(
              `📊 Flushing buffered engagement data to database for ${sessionId}...`
            );
            engagementService
              .flushEngagementToDatabase(
                sessionId,
                session.engagementBuffer,
                callerNumber,
                session.startTime
              )
              .catch((error) =>
                logger.error("Failed to flush engagement data:", error)
              );
          }
        }

        res.status(200).send("");
        return;
      }

      // For active incoming calls (isActive="1"), respond with IVR XML
      logger.info(
        "✅ ACTIVE INCOMING CALL (isActive=1) - generating IVR response",
        {
          sessionId,
          callerNumber,
          destinationNumber,
          isActive,
        }
      );

      // Create session for the incoming call
      if (sessionId && callerNumber) {
        sessionManager.createSession(sessionId, callerNumber);
        logger.info(`📝 Created session for incoming call: ${sessionId}`);

        // Store engagement metadata (buffered - no DB write)
        sessionManager.setEngagementMetadata(sessionId, {
          callId: sessionId,
          userAgent: req.get("User-Agent"),
          ipAddress: req.ip,
        });

        // Track initial state transition to welcome (buffered - no DB write)
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.CALL_INITIATED,
          IVRState.WELCOME
        );
        logger.info(
          `📊 Buffered welcome state for ${sessionId} (no DB write during call)`
        );
      }

      // Generate welcome response
      const welcomeXML = await africasTalkingService.generateWelcomeResponse();

      logger.info("🎤 SENDING IVR XML RESPONSE:");
      logger.info(welcomeXML);
      res.set("Content-Type", "application/xml");
      res.send(welcomeXML);
    } catch (error) {
      logger.error("💥 ERROR handling incoming call:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  handleLanguageSelection = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const {
        sessionId,
        isActive,
        dtmfDigits,
        recordingUrl,
        callRecordingUrl,
      } = webhookData;

      logger.info(`=== LANGUAGE SELECTION WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(
        `Language selection - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}`
      );

      // LOG CALLER INFORMATION
      logger.info('📞 === CALLER INFO (Language Selection) ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Caller Number: ${webhookData.callerNumber || 'N/A'}`);
      logger.info(`Is Active: ${isActive}`);
      logger.info(`DTMF Input: ${dtmfDigits || 'N/A'}`);
      logger.info('=== END CALLER INFO ===');

      // If call is not active, end call
      if (isActive === "0") {
        const recording = recordingUrl || callRecordingUrl;
        if (recording) {
          logger.info(
            `Session ${sessionId} completed with recording. URL: ${recording}`
          );
        } else {
          logger.info(`Session ${sessionId} ended after language selection.`);
        }

        // Flush buffered data when call ends in language selection
        const session = sessionManager.getSession(sessionId);
        if (session && session.engagementBuffer) {
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.USER_HANGUP,
            false
          );
          sessionManager.bufferStateTransition(
            sessionId,
            session.engagementBuffer.currentState ||
              IVRState.LANGUAGE_SELECTION,
            IVRState.CALL_ENDED
          );

          engagementService
            .flushEngagementToDatabase(
              sessionId,
              session.engagementBuffer,
              session.callerNumber,
              session.startTime
            )
            .catch((error) =>
              logger.error("Failed to flush engagement data:", error)
            );
        }

        res.status(200).send("");
        return;
      }

      // Handle timeout - no input received
      if (!dtmfDigits || dtmfDigits.trim() === "") {
        logger.info(
          `⏱️ Language selection timeout (no input) for session: ${sessionId}`
        );
        const timeoutAudio = await this.generateStaticAudioSay(
          "languageTimeout",
          "en"
        );
        const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/language-timeout">
    ${timeoutAudio}
  </GetDigits>
  <Redirect>${config.webhook.baseUrl}/voice/end</Redirect>
</Response>`;

        logger.info(`🎤 SENDING LANGUAGE TIMEOUT RESPONSE:`);
        logger.info(responseXML);
        res.set("Content-Type", "application/xml");
        res.send(responseXML);
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || "");
      let responseXML = "";
      let selectedLanguage = "en";
      const ttsAvailable = africasTalkingService.isTTSAvailable();

      // If TTS is not available, only allow English (option 1) or end call (option 0)
      if (
        !ttsAvailable &&
        typeof choice === "number" &&
        ![1, 0].includes(choice)
      ) {
        logger.warn(
          `TTS unavailable, rejecting non-English choice: ${choice} for session: ${sessionId}`
        );
        responseXML =
          await africasTalkingService.generateLanguageMenuResponse();
      } else {
        switch (choice) {
          case 1: // English
            selectedLanguage = "en";
            responseXML =
              await africasTalkingService.generateDirectRecordingResponse("en");
            break;

          case 2: // Yoruba (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = "yo";
              responseXML =
                await africasTalkingService.generateDirectRecordingResponse(
                  "yo"
                );
            } else {
              logger.warn(
                `TTS unavailable, rejecting Yoruba choice for session: ${sessionId}`
              );
              responseXML =
                await africasTalkingService.generateLanguageMenuResponse();
            }
            break;

          case 3: // Hausa (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = "ha";
              responseXML =
                await africasTalkingService.generateDirectRecordingResponse(
                  "ha"
                );
            } else {
              logger.warn(
                `TTS unavailable, rejecting Hausa choice for session: ${sessionId}`
              );
              responseXML =
                await africasTalkingService.generateLanguageMenuResponse();
            }
            break;

          case 4: // Igbo (only if TTS available)
            if (ttsAvailable) {
              selectedLanguage = "ig";
              responseXML =
                await africasTalkingService.generateDirectRecordingResponse(
                  "ig"
                );
            } else {
              logger.warn(
                `TTS unavailable, rejecting Igbo choice for session: ${sessionId}`
              );
              responseXML =
                await africasTalkingService.generateLanguageMenuResponse();
            }
            break;

          case 5: // Repeat menu
            responseXML =
              await africasTalkingService.generateLanguageMenuResponse();
            break;

          case 0: // End call
            const goodbyeMessage = this.getGoodbyeMessage(
              selectedLanguage as "en" | "yo" | "ha" | "ig"
            );
            const callerNumber = webhookData.callerNumber || 'unknown';
            responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateLanguageSpecificSay(
    goodbyeMessage,
    selectedLanguage as "en" | "yo" | "ha" | "ig",
    callerNumber
  )}
</Response>`;
            break;

          default:
            logger.warn(
              `Invalid language choice: ${choice} for session: ${sessionId}`
            );
            responseXML =
              await africasTalkingService.generateLanguageMenuResponse();
        }
      }

      // Store selected language in session if valid choice - both in context AND at session level
      if (typeof choice === "number" && [1, 2, 3, 4].includes(choice)) {
        // Update in both places for maximum persistence
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.language = selectedLanguage as "en" | "yo" | "ha" | "ig";
          sessionManager.saveSession(session);
        }
        sessionManager.updateSessionContext(sessionId, {
          language: selectedLanguage,
        });
        sessionManager.updateSessionMenu(sessionId, "recording");
        logger.info(
          `✅ Language ${selectedLanguage} LOCKED for session: ${sessionId}, going directly to recording`
        );

        // Track language selection (buffered - no DB write)
        sessionManager.bufferLanguageSelection(
          sessionId,
          selectedLanguage as "en" | "yo" | "ha" | "ig"
        );
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.LANGUAGE_SELECTION,
          IVRState.RECORDING_PROMPT,
          dtmfDigits || choice.toString()
        );
        logger.info(
          `📊 Buffered language selection ${selectedLanguage} for ${sessionId}`
        );
      } else if (choice === 0) {
        // Track call end choice (buffered - no DB write)
        sessionManager.setTerminationInfo(
          sessionId,
          TerminationReason.COMPLETED_SUCCESSFULLY,
          true
        );
        logger.info(`📊 Buffered call end choice for ${sessionId}`);
      }

      // Log the XML response being sent
      logger.info(`🎤 SENDING LANGUAGE SELECTION RESPONSE:`);
      logger.info(responseXML);

      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("Error handling language selection:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  handleLanguageTimeout = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;

      logger.info(`=== LANGUAGE TIMEOUT WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(
        `Language timeout - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}`
      );

      // If call is not active, end call
      if (isActive === "0") {
        const session = sessionManager.getSession(sessionId);
        if (session && session.engagementBuffer) {
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.USER_HANGUP,
            false
          );
          sessionManager.bufferStateTransition(
            sessionId,
            session.engagementBuffer.currentState || IVRState.TIMEOUT,
            IVRState.CALL_ENDED
          );

          engagementService
            .flushEngagementToDatabase(
              sessionId,
              session.engagementBuffer,
              session.callerNumber,
              session.startTime
            )
            .catch((error) =>
              logger.error("Failed to flush engagement data:", error)
            );
        }

        res.status(200).send("");
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits || "");
      let responseXML = "";

      // Check if user made a valid language selection (1-4)
      let selectedLanguage = "";
      const ttsAvailable = africasTalkingService.isTTSAvailable();

      if (choice === 1) {
        selectedLanguage = "en";
      } else if (choice === 2 && ttsAvailable) {
        selectedLanguage = "yo";
      } else if (choice === 3 && ttsAvailable) {
        selectedLanguage = "ha";
      } else if (choice === 4 && ttsAvailable) {
        selectedLanguage = "ig";
      }

      if (selectedLanguage) {
        // Valid language selected - continue to recording
        logger.info(
          `✅ Language selected after timeout: ${selectedLanguage} for session: ${sessionId}`
        );

        const session = sessionManager.getSession(sessionId);
        if (session) {
          sessionManager.updateSessionContext(sessionId, {
            language: selectedLanguage as "en" | "yo" | "ha" | "ig",
          });
          sessionManager.bufferLanguageSelection(
            sessionId,
            selectedLanguage as "en" | "yo" | "ha" | "ig"
          );
        }

        const directRecordingAudio = await this.generateStaticAudioSay(
          "directRecording",
          selectedLanguage as "en" | "yo" | "ha" | "ig"
        );

        responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="3" finishOnKey="#">
    ${directRecordingAudio}
  </GetDigits>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="${
    config.webhook.baseUrl
  }/voice/recording/${selectedLanguage}">
  </Record>
</Response>`;
      } else {
        // No valid input - abort call after 3 seconds
        logger.warn(
          `⏱️ No response after language timeout - aborting call for session: ${sessionId}`
        );
        const goodbyeAudio = await this.generateStaticAudioSay("goodbye", "en");
        responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="3" finishOnKey="#">
    ${goodbyeAudio}
  </GetDigits>
  <Redirect>${config.webhook.baseUrl}/voice/end</Redirect>
</Response>`;

        sessionManager.setTerminationInfo(
          sessionId,
          TerminationReason.TIMEOUT,
          false
        );
      }

      logger.info(`🎤 SENDING LANGUAGE TIMEOUT HANDLER RESPONSE:`);
      logger.info(responseXML);
      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("Error handling language timeout:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  handleRecording = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const {
        sessionId,
        isActive,
        recordingUrl,
        callRecordingUrl,
        callRecordingDurationInSeconds,
      } = webhookData;

      const recording = recordingUrl || callRecordingUrl;
      logger.info(`=== RECORDING WEBHOOK ===`);
      logger.info(`Full webhook data:`, JSON.stringify(webhookData, null, 2));
      logger.info(
        `Recording received - Session: ${sessionId}, Active: ${isActive}, URL: ${recording}, Duration: ${callRecordingDurationInSeconds}s`
      );

      // LOG CALLER INFORMATION AND RECORDING DATA
      logger.info('📞 === CALLER INFO (Recording) ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Caller Number: ${webhookData.callerNumber || 'N/A'}`);
      logger.info(`Is Active: ${isActive}`);
      logger.info(`Recording URL: ${recording || 'N/A'}`);
      logger.info(`callRecordingDurationInSeconds: ${callRecordingDurationInSeconds} (${typeof callRecordingDurationInSeconds})`);
      logger.info(`durationInSeconds: ${webhookData.durationInSeconds} (${typeof webhookData.durationInSeconds})`);
      logger.info('📊 All webhook fields related to duration:');
      Object.keys(webhookData).filter(key => key.toLowerCase().includes('duration') || key.toLowerCase().includes('time')).forEach(key => {
        logger.info(`  ${key}: ${(webhookData as any)[key]}`);
      });
      logger.info('=== END CALLER INFO ===');

      // If call is not active, process recording if available then return
      if (isActive === "0") {
        if (recording) {
          logger.info(
            `Session ${sessionId}: Recording completed. URL: ${recording}, Duration: ${callRecordingDurationInSeconds}s`
          );

          // Store recording URL
          sessionManager.updateSessionContext(sessionId, {
            recordingUrl: recording,
            recordingDuration: callRecordingDurationInSeconds,
          });

          // Process recording even when call is inactive
          const session = sessionManager.getSession(sessionId);
          const sessionLanguage = (session?.context?.language ||
            session?.language ||
            "en") as "en" | "yo" | "ha" | "ig";

          logger.info(
            `🚀 Starting background processing for inactive session: ${sessionId}`
          );
          this.processRecordingInBackground(
            sessionId,
            recording,
            sessionLanguage
          ).catch((err) => {
            logger.error(
              `Background processing failed for session ${sessionId}:`,
              err
            );
            sessionManager.updateSessionContext(sessionId, {
              processingError: true,
            });
          });
        }

        // Flush buffered data when call ends during recording
        const session = sessionManager.getSession(sessionId);
        if (session && session.engagementBuffer) {
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.USER_HANGUP,
            false
          );
          sessionManager.bufferStateTransition(
            sessionId,
            session.engagementBuffer.currentState ||
              IVRState.RECORDING_IN_PROGRESS,
            IVRState.CALL_ENDED
          );

          engagementService
            .flushEngagementToDatabase(
              sessionId,
              session.engagementBuffer,
              session.callerNumber,
              session.startTime
            )
            .catch((error) =>
              logger.error("Failed to flush engagement data:", error)
            );
        }

        res.status(200).send("");
        return;
      }

      // Get session language IMMEDIATELY for appropriate voice
      const session = sessionManager.getSession(sessionId);
      const sessionLanguage = (session?.context?.language ||
        session?.language ||
        "en") as "en" | "yo" | "ha" | "ig";

      // Check if we have a recording URL
      if (!recording) {
        logger.warn(`⚠️ No recording URL received for session: ${sessionId}`);
        // Return error and ask to try again
        const errorXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateStaticAudioSay("noRecording", sessionLanguage)}
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>
</Response>`;
        res.set("Content-Type", "application/xml");
        res.send(errorXML);
        return;
      }

      // Store recording URL for immediate processing
      sessionManager.updateSessionContext(sessionId, {
        recordingUrl: recording,
        recordingDuration: callRecordingDurationInSeconds,
      });

      // Track recording state transition (buffered - no DB write)
      sessionManager.bufferStateTransition(
        sessionId,
        IVRState.RECORDING_PROMPT,
        IVRState.RECORDING_IN_PROGRESS
      );
      sessionManager.bufferStateTransition(
        sessionId,
        IVRState.RECORDING_IN_PROGRESS,
        IVRState.AI_PROCESSING
      );
      logger.info(`📊 Buffered recording states for ${sessionId}`);

      // Optimized approach: immediate processing + extended processing message
      logger.info(`🚀 Starting optimized processing for session: ${sessionId}`);

      // Start background processing immediately (don't await)
      this.processRecordingInBackground(
        sessionId,
        recording,
        sessionLanguage
      ).catch((err) => {
        logger.error(
          `Background processing failed for session ${sessionId}:`,
          err
        );
        sessionManager.updateSessionContext(sessionId, {
          processingError: true,
        });
      });

      // Respond with extended processing message to give AI time to complete
      const processingAudio = await this.generateStaticAudioSay(
        "processing",
        sessionLanguage
      );
      const waitAudio = await this.generateStaticAudioSay(
        "wait",
        sessionLanguage
      );

      // Play messages multiple times to keep call active while AI processes (~15-20 seconds total)
      // Note: Africa's Talking <Pause> tag doesn't work reliably, so we repeat audio instead
      const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${processingAudio}
  ${waitAudio}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      logger.info(`🎤 SENDING IMMEDIATE PROCESSING RESPONSE:`);
      logger.info(responseXML);
      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("💥 ERROR handling recording:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  handlePostAI = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;
      const languageParam = (req.query.language as string) || "en";

      logger.info(`=== POST-AI WEBHOOK ===`);
      logger.info(
        `Post-AI - Session: ${sessionId}, Active: ${isActive}, DTMF: ${dtmfDigits}, Language: ${languageParam}`
      );

      // LOG CALLER INFORMATION
      logger.info('📞 === CALLER INFO (Post-AI Menu) ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Caller Number: ${webhookData.callerNumber || 'N/A'}`);
      logger.info(`Is Active: ${isActive}`);
      logger.info(`DTMF Input: ${dtmfDigits || 'N/A'}`);
      logger.info(`Language: ${languageParam}`);
      logger.info('=== END CALLER INFO ===');

      // If call is not active, end call
      if (isActive === "0") {
        logger.info(`Session ${sessionId} ended after post-AI.`);

        // Flush buffered data when call ends in post-AI
        const session = sessionManager.getSession(sessionId);
        if (session && session.engagementBuffer) {
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.USER_HANGUP,
            false
          );
          sessionManager.bufferStateTransition(
            sessionId,
            session.engagementBuffer.currentState || IVRState.POST_AI_MENU,
            IVRState.CALL_ENDED
          );

          engagementService
            .flushEngagementToDatabase(
              sessionId,
              session.engagementBuffer,
              session.callerNumber,
              session.startTime
            )
            .catch((error) =>
              logger.error("Failed to flush engagement data:", error)
            );
        }

        res.status(200).send("");
        return;
      }

      // If no DTMF digits, this is the initial redirect - show the post-AI menu
      if (!dtmfDigits) {
        // Track state transition to post-AI menu (buffered - no DB write)
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.AI_RESPONSE,
          IVRState.POST_AI_MENU
        );
        logger.info(`📊 Buffered post-AI menu state for ${sessionId}`);

        const responseXML =
          await africasTalkingService.generatePostAIMenuResponse(languageParam);

        res.set("Content-Type", "application/xml");
        res.send(responseXML);
        return;
      }

      // Handle user's choice
      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);
      let responseXML = "";
      const language = languageParam as "en" | "yo" | "ha" | "ig";

      // Track post-AI menu choice (buffered - no DB write)
      switch (choice) {
        case 1:
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.FOLLOW_UP_RECORDING,
            dtmfDigits
          );
          break;
        case 2:
          sessionManager.bufferAgentTransfer(sessionId);
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.HUMAN_AGENT_TRANSFER,
            dtmfDigits
          );
          break;
        case 3:
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.WELCOME,
            dtmfDigits
          );
          break;
        case 0:
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.COMPLETED_SUCCESSFULLY,
            true
          );
          break;
      }
      logger.info(`📊 Buffered post-AI choice ${choice} for ${sessionId}`);

      switch (choice) {
        case 1: // Ask another question - use follow-up recording (no language selection message)
          responseXML =
            await africasTalkingService.generateFollowUpRecordingResponse(
              language
            );
          break;

        case 2: // Speak with human expert
          responseXML = await africasTalkingService.generateTransferResponse(
            language
          );
          break;

        case 3: // Go back to main menu
          responseXML = await africasTalkingService.generateWelcomeResponse();
          break;

        case 0: // End call
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.generateStaticAudioSay("goodbye", language)}
</Response>`;
          break;

        default:
          // Invalid choice - repeat the menu
          responseXML = await africasTalkingService.generatePostAIMenuResponse(
            language
          );
      }

      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("Error handling post-AI:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  private cleanAIResponse(response: string): string {
    // Complete text processing for audio delivery
    return (
      response
        // Remove markdown formatting
        .replace(/\*\*/g, "") // Remove bold markdown
        .replace(/\*/g, "") // Remove italic markdown
        .replace(/##\s*/g, "") // Remove heading markdown
        .replace(/#\s*/g, "") // Remove heading markdown

        // Remove robotic labels (Problem:, Cause:, Solution:, etc.) - make it conversational
        .replace(/\*\*Problem:\*\*/gi, "")
        .replace(/\*\*Cause:\*\*/gi, "")
        .replace(/\*\*Solution:\*\*/gi, "")
        .replace(/\*\*Prevention:\*\*/gi, "")
        .replace(/\*\*When to call vet:\*\*/gi, "If you need a vet:")
        .replace(/Problem:\s*/gi, "")
        .replace(/Cause:\s*/gi, "")
        .replace(/Solution:\s*/gi, "")
        .replace(/Prevention:\s*/gi, "To prevent this,")
        .replace(/When to call vet:\s*/gi, "Call your vet if")

        // Handle measurements and abbreviations
        .replace(/Dr\./g, "Doctor")
        .replace(/(\d+)\s*mg/g, "$1 milligrams")
        .replace(/(\d+)\s*ml/g, "$1 milliliters")
        .replace(/(\d+)\s*kg/g, "$1 kilograms")
        .replace(/(\d+)°C/g, "$1 degrees Celsius")

        // Clean up line breaks and spacing
        .replace(/\n\s*[\d\-\*]\.\s*/g, ". ") // Convert numbered/bulleted lists to sentences
        .replace(/\n\s*[\-\*]\s*/g, ". ") // Convert bullet points to sentences
        .replace(/\n\s*\n/g, ". ") // Replace double newlines with period
        .replace(/\n/g, " ") // Replace single newlines with space

        // Clean up punctuation
        .replace(/\.\s*\./g, ".") // Remove double periods
        .replace(/\s*:\s*/g, ": ") // Clean up colons
        .replace(/\s+/g, " ") // Remove extra spaces
        .replace(/\s+\./g, ".") // Remove spaces before periods
        .trim()
    );
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
    const lastPeriod = truncated.lastIndexOf(".");
    const lastExclamation = truncated.lastIndexOf("!");
    const lastQuestion = truncated.lastIndexOf("?");

    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentenceEnd > 0) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // If no sentence boundary found, just truncate and add period
    return truncated.trim() + ".";
  }

  /**
   * Generate language-specific Say tag using TTS when available, fallback to default voice
   */
  private async generateLanguageSpecificSay(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber?: string
  ): Promise<string> {
    try {
      // This is for dynamic AI responses only - static messages use staticAudioService directly
      const audioUrl = await africasTalkingService.generateTTSAudio(
        text,
        language,
        phoneNumber || 'unknown'
      );
      if (audioUrl) {
        return `<Play url="${audioUrl}"/>`;
      }
    } catch (error) {
      logger.warn(
        `Failed to generate TTS for language ${language}, falling back to Say tag:`,
        error
      );
    }

    // Fallback to Say tag
    return `<Say voice="woman">${this.escapeXML(text)}</Say>`;
  }

  /**
   * Generate static audio using pre-generated files
   */
  private async generateStaticAudioSay(
    textKey:
      | "welcome"
      | "processing"
      | "error"
      | "goodbye"
      | "noRecording"
      | "wait"
      | "directRecording"
      | "followUpRecording"
      | "postAIMenu"
      | "noInputMessage"
      | "transfer"
      | "languageTimeout",
    language: "en" | "yo" | "ha" | "ig"
  ): Promise<string> {
    try {
      // First try to get pre-generated static audio
      const staticAudioService = (
        await import("../services/staticAudioService")
      ).default;
      const audioUrl = staticAudioService.getStaticAudioUrl(language, textKey);

      if (audioUrl) {
        logger.info(
          `🎵 Using pre-generated static audio for ${language}_${textKey}`
        );
        return `<Play url="${audioUrl}"/>`;
      } else {
        logger.warn(
          `⚠️ No pre-generated audio for ${language}_${textKey}, generating dynamically`
        );
        const text = staticAudioService.getStaticText(language, textKey);
        return await this.generateLanguageSpecificSay(text, language);
      }
    } catch (error) {
      logger.error(
        `Error generating static audio for ${language}_${String(textKey)}:`,
        error
      );
      // Fallback to basic Say tag
      return `<Say voice="woman">System message</Say>`;
    }
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Get no-recording error message in appropriate language
   */
  private getNoRecordingMessage(language: "en" | "yo" | "ha" | "ig"): string {
    const messages = {
      en: "I didn't hear your recording. Please try again and speak after the beep.",
      yo: "Mi ò gbọ́ ìgbóhùn yín. Ẹ jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan si, kí ẹ sì sọ̀rọ̀ lẹ́yìn ìró àlámọ́.",
      ha: "Ban ji rikodin ku ba. Don Allah ku sake gwadawa kuma ku yi magana bayan sautin.",
      ig: "Anụghị m ndekọ gị. Biko gbalịa ọzọ ma kwuo okwu mgbe ụda ahụ gasịrị.",
    };
    return messages[language] || messages.en;
  }

  /**
   * Get processing message in appropriate language
   */
  private getProcessingMessage(language: "en" | "yo" | "ha" | "ig"): string {
    const messages = {
      en: "Thank you for your question. Agrocist is analyzing your concern.",
      yo: "A dúpẹ́ fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìṣòro yín.",
      ha: "Na gode da tambayar ku. Agrocist yana nazarin damuwar ku.",
      ig: "Daalụ maka ajụjụ gị. Agrocist na-enyocha nsogbu gị.",
    };
    return messages[language] || messages.en;
  }

  /**
   * Get goodbye message in appropriate language
   */
  private getGoodbyeMessage(language: "en" | "yo" | "ha" | "ig"): string {
    const messages = {
      en: "Thank you for using Agrocist. Have a great day!",
      yo: "A dúpẹ́ fún lilo Agrocist. Ẹ ní ọjọ́ tí ó dára!",
      ha: "Na gode da amfani da Agrocist. Ku yi kyakkyawan rana!",
      ig: "Daalụ maka iji Agrocist. Nwee ụbọchị ọma!",
    };
    return messages[language] || messages.en;
  }

  /**
   * Process recording in background for speed - no TTS generation to avoid delays
   */
  private async processRecordingInBackground(
    sessionId: string,
    recordingUrl: string,
    language: "en" | "yo" | "ha" | "ig"
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Clear any previous AI response and TTS cache to prevent reuse from earlier questions
      sessionManager.updateSessionContext(sessionId, {
        preGeneratedAudioTag: undefined,
        ttsGenerating: false,
        aiResponse: undefined,
        aiReady: false,
        ttsGenerationFailed: false
      });

      // 1. Transcribe audio
      logger.info(`⚡ Starting transcription for session ${sessionId}`);
      const farmerText = await aiService.transcribeAudio(recordingUrl, language);
      const transcriptionTime = Date.now() - startTime;
      logger.info(
        `⚡ Transcription completed in ${transcriptionTime}ms: "${farmerText}"`
      );

      // LOG USER TRANSCRIPTION
      logger.info('🎤 === USER TRANSCRIPTION ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Language: ${language}`);
      logger.info(`Recording URL: ${recordingUrl}`);
      logger.info(`User Said: "${farmerText}"`);
      logger.info(`Transcription Time: ${transcriptionTime}ms`);
      logger.info('=== END USER TRANSCRIPTION ===');

      // 2. Store transcription
      sessionManager.updateSessionContext(sessionId, {
        transcription: farmerText,
      });

      // 3. Process with AI
      logger.info(`⚡ Starting AI processing for session ${sessionId}`);
      const aiStartTime = Date.now();
      const aiResponse = await aiService.processVeterinaryQuery(farmerText, {
        menu: "veterinary_ai",
        farmerId: sessionId,
        language: language,
      });
      const aiTime = Date.now() - aiStartTime;
      logger.info(`⚡ AI processing completed in ${aiTime}ms`);

      // 4. Clean and truncate response
      const cleanedResponse = this.cleanAIResponse(aiResponse.response);
      const truncatedResponse = this.truncateForAudio(cleanedResponse);
      logger.info(
        `📝 Truncated AI response from ${cleanedResponse.length} to ${truncatedResponse.length} characters`
      );

      // LOG AI RESPONSE
      logger.info('🤖 === AI RESPONSE ===');
      logger.info(`Session ID: ${sessionId}`);
      logger.info(`Language: ${language}`);
      logger.info(`User Query: "${farmerText}"`);
      logger.info(`AI Original Response: "${aiResponse.response}"`);
      logger.info(`AI Cleaned Response: "${cleanedResponse}"`);
      logger.info(`AI Final Response (truncated): "${truncatedResponse}"`);
      logger.info(`AI Processing Time: ${aiTime}ms`);
      logger.info(`AI Confidence: ${aiResponse.confidence || 'N/A'}`);
      logger.info('=== END AI RESPONSE ===');

      // 5. Store AI interaction and mark as ready
      sessionManager.addAIInteraction(
        sessionId,
        farmerText,
        truncatedResponse,
        0.9,
        "veterinary"
      );
      sessionManager.updateSessionContext(sessionId, {
        aiResponse: truncatedResponse,
        aiReady: true,
      });

      // 6. Track AI interaction in engagement metrics (buffered - no DB write)
      const session = sessionManager.getSession(sessionId);
      const recordingDuration = session?.context?.recordingDuration || 0;

      sessionManager.bufferAIInteraction(
        sessionId,
        recordingDuration,
        farmerText,
        truncatedResponse,
        aiTime,
        0, // TTS generation time (generated in next step)
        language,
        aiResponse.confidence
      );
      logger.info(
        `📊 Buffered AI interaction for ${sessionId} (${aiTime}ms processing)`
      );

      // 7. Mark TTS generation as "in progress" and start in background
      sessionManager.updateSessionContext(sessionId, {
        ttsGenerating: true,
      });
      logger.info(
        `🎵 Starting TTS pre-generation for AI response (non-blocking)...`
      );

      const ttsStartTime = Date.now();
      const callerNumber = session?.callerNumber || 'unknown';
      this.generateLanguageSpecificSay(truncatedResponse, language, callerNumber)
        .then((audioTag) => {
          const ttsTime = Date.now() - ttsStartTime;
          sessionManager.updateSessionContext(sessionId, {
            preGeneratedAudioTag: audioTag,
            ttsGenerating: false,
          });
          // Update the TTS generation time in the last interaction
          sessionManager.updateLastInteractionTTSTime(sessionId, ttsTime);
          logger.info(`✅ TTS audio pre-generated and cached for ${sessionId} in ${ttsTime}ms`);
        })
        .catch((err) => {
          sessionManager.updateSessionContext(sessionId, {
            ttsGenerating: false,
            ttsGenerationFailed: true,
          });
          logger.warn(`⚠️ TTS pre-generation failed for ${sessionId}:`, err);
        });

      const totalTime = Date.now() - startTime;
      logger.info(
        `⚡ Background processing completed in ${totalTime}ms (Transcription: ${transcriptionTime}ms, AI: ${aiTime}ms, TTS: generating in background)`
      );
    } catch (error) {
      logger.error(
        `Error in background processing for session ${sessionId}:`,
        error
      );
      sessionManager.updateSessionContext(sessionId, { processingError: true });

      // Track processing error (buffered - no DB write)
      sessionManager.bufferError(
        sessionId,
        `AI processing error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        IVRState.AI_PROCESSING,
        "high"
      );
      logger.info(`📊 Buffered processing error for ${sessionId}`);
    }
  }

  handleAIProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session as string;
      const webhookData = req.body as AfricasTalkingWebhook;
      const { isActive } = webhookData;

      logger.info(
        `🤖 CHECKING AI RESULTS for session: ${sessionId}, isActive: ${isActive}`
      );

      // If call is not active, just return empty response
      if (isActive === "0") {
        logger.info(
          `❌ Call ended for session: ${sessionId}, returning empty response`
        );
        res.status(200).send("");
        return;
      }

      // Get session data
      const session = sessionManager.getSession(sessionId);
      if (!session) {
        logger.error(`No session found: ${sessionId}`);
        res.set("Content-Type", "application/xml");
        res.send(await africasTalkingService.generateErrorResponse());
        return;
      }

      const language = (session.context.language ||
        session.language ||
        "en") as "en" | "yo" | "ha" | "ig";

      // Check if processing encountered an error
      if (session.context.processingError) {
        logger.error(`Processing error detected for session: ${sessionId}`);
        res.set("Content-Type", "application/xml");
        res.send(await africasTalkingService.generateErrorResponse(language));
        return;
      }

      // Check if AI response is ready
      if (session.context.aiReady && session.context.aiResponse) {
        logger.info(`✅ AI response ready for session ${sessionId}`);
        const aiResponse = session.context.aiResponse;

        // Track state transition to AI response (buffered - no DB write)
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.AI_PROCESSING,
          IVRState.AI_RESPONSE
        );
        logger.info(`📊 Buffered AI response state for ${sessionId}`);

        // Check if TTS was pre-generated, is generating, or needs generation
        const ttsStartTime = Date.now();
        let audioTag: string | undefined;

        if (session.context.preGeneratedAudioTag) {
          // Use pre-generated audio (instant)
          audioTag = session.context.preGeneratedAudioTag;
          logger.info(
            `⚡ Using pre-generated TTS audio (instant) for ${sessionId}`
          );
        } else if (session.context.ttsGenerating) {
          // Wait for ongoing background generation instead of starting new one
          logger.info(
            `⏳ Waiting for background TTS generation to complete for ${sessionId}...`
          );

          // Poll for completion (max 35 seconds)
          const maxWaitTime = 35000;
          const pollInterval = 500;
          const startWait = Date.now();

          while (
            session.context.ttsGenerating &&
            Date.now() - startWait < maxWaitTime
          ) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            // Refresh session to get latest context
            const updatedSession = sessionManager.getSession(sessionId);
            if (updatedSession?.context.preGeneratedAudioTag) {
              audioTag = updatedSession.context.preGeneratedAudioTag;
              const waitTime = Date.now() - startWait;
              logger.info(
                `⚡ Background TTS completed after ${waitTime}ms wait for ${sessionId}`
              );
              break;
            }
          }

          // If still not ready after waiting, generate now
          if (!audioTag) {
            logger.warn(
              `⚠️ Background TTS timeout, generating on-demand for ${sessionId}`
            );
            audioTag = await this.generateLanguageSpecificSay(
              aiResponse,
              language,
              session.callerNumber
            );
          }
        } else {
          // Generate now if pre-generation wasn't started or failed
          logger.info(
            `🎵 Generating AI response audio on-demand (no background generation) for ${sessionId}...`
          );
          audioTag = await this.generateLanguageSpecificSay(
            aiResponse,
            language,
            session.callerNumber
          );
          const ttsTime = Date.now() - ttsStartTime;
          logger.info(
            `⚡ AI response audio generated on-demand in ${ttsTime}ms`
          );
        }

        // Use pre-generated static audio for menu prompts (instant)
        const postAIAudio = await this.generateStaticAudioSay(
          "postAIMenu",
          language
        );
        const noInputMessage = await this.generateStaticAudioSay(
          "noInputMessage",
          language
        );

        const totalTime = Date.now() - ttsStartTime;
        logger.info(`⚡ Total audio preparation time: ${totalTime}ms`);

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
        res.set("Content-Type", "application/xml");
        res.send(responseXML);
        return;
      }

      // If not ready yet, play wait message multiple times and redirect back
      logger.info(
        `⏳ AI still processing for session ${sessionId}, playing wait message...`
      );
      const currentSession = sessionManager.getSession(sessionId);
      const lang = (currentSession?.context?.language ||
        currentSession?.language ||
        "en") as "en" | "yo" | "ha" | "ig";
      const waitAudio = await this.generateStaticAudioSay("wait", lang);

      const redirectXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${waitAudio}
  ${waitAudio}
  ${waitAudio}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`;

      res.set("Content-Type", "application/xml");
      res.send(redirectXML);
    } catch (error) {
      logger.error("💥 ERROR processing AI request:", error);
      const session = sessionManager.getSession(req.query.session as string);
      const lang = (session?.context?.language || session?.language || "en") as
        | "en"
        | "yo"
        | "ha"
        | "ig";
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse(lang));
    }
  };

  /**
   * Get wait message in appropriate language (for polling)
   */
  private getWaitMessage(language: "en" | "yo" | "ha" | "ig"): string {
    const messages = {
      en: "Just a moment, processing your request.",
      yo: "Ẹ dúró díẹ̀, a ń ṣe ìbéèrè yín.",
      ha: "Don Allah ku ɗan jira, muna aiwatar da buƙatarku.",
      ig: "Chere ntakịrị, anyị na-edozi ihe ị chọrọ.",
    };
    return messages[language] || messages.en;
  }

  /**
   * Determine termination reason based on call data
   */
  private determineTerminationReason(
    callEndReason?: string,
    duration?: number
  ): TerminationReason {
    if (!duration || duration < 5) {
      return TerminationReason.NETWORK_ISSUE;
    }

    if (callEndReason) {
      const reason = callEndReason.toLowerCase();
      if (reason.includes("timeout")) {
        return TerminationReason.TIMEOUT;
      }
      if (reason.includes("error") || reason.includes("failed")) {
        return TerminationReason.SYSTEM_ERROR;
      }
      if (reason.includes("completed") || reason.includes("success")) {
        return TerminationReason.COMPLETED_SUCCESSFULLY;
      }
    }

    // Default to user hangup if duration is reasonable
    return TerminationReason.USER_HANGUP;
  }
}

export default new VoiceController();
