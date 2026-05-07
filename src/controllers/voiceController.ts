import { Request, Response } from "express";
import { AfricasTalkingWebhook } from "../types";
import africasTalkingService from "../services/africasTalkingService";
import aiService from "../services/aiService";
import sessionManager from "../utils/sessionManager";
import logger from "../utils/logger";
import config from "../config";
import engagementService from "../services/engagementService";
import { IVRState, TerminationReason } from "../models/EngagementMetrics";
import { getAgentForCaller } from "../config/callerAgentMapping";
import agentCallLogService from "../services/agentCallLogService";
import staticAudioService from "../services/staticAudioService";
import { StaticAudioKey } from "../services/staticAudioService";
import User from "../models/User";

/**
 * Handles all Africa's Talking voice webhooks for the Agrocist IVR system.
 *
 * Call flow:
 *   1. handleIncomingCall      — creates session, checks agent mapping, plays welcome gate
 *   1b. handleGate             — caller chooses AI (1) or human agent (2)
 *   2. handleLanguageSelection — stores language choice, routes to recording (AI path only)
 *   3. handleLanguageTimeout   — second-chance handler if no input on language menu
 *   4. handleRecording         — receives voice recording, starts background AI processing
 *   5. handleAIProcessing      — polls for AI readiness, plays response when ready
 *   6. handlePostAI            — handles post-response menu (follow-up / agent / end)
 */
class VoiceController {
  // ─── 1. Incoming call ──────────────────────────────────────────────────────

  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        sessionId,
        isActive,
        callerNumber,
        durationInSeconds = "0",
        callEndReason,
      } = req.body;

      logger.info("=== INCOMING CALL ===", {
        sessionId,
        callerNumber,
        isActive,
      });

      // isActive === "0" means the call has ended — flush engagement data and return
      if (isActive === "0") {
        logger.info(`Call ended: ${sessionId} (${durationInSeconds}s)`);
        await this.flushOnCallEnd(
          sessionId,
          callerNumber,
          callEndReason,
          durationInSeconds,
        );
        res.status(200).send("");
        return;
      }

      // New call — create session and track initial state
      if (sessionId && callerNumber) {
        sessionManager.createSession(sessionId, callerNumber);
        sessionManager.setEngagementMetadata(sessionId, {
          callId: sessionId,
          userAgent: req.get("User-Agent"),
          ipAddress: req.ip,
        });
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.CALL_INITIATED,
          IVRState.WELCOME,
        );
      }

      const welcomeXML = await this.generateWelcomeWithAgentCheck(
        callerNumber,
        sessionId,
      );
      res.set("Content-Type", "application/xml");
      res.send(welcomeXML);
    } catch (error) {
      logger.error("Error handling incoming call:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  // ─── 1b. Gate menu (AI vs human agent) ────────────────────────────────────

  /**
   * Handles the caller's response to the gate menu:
   *   1 → AI assistant path (proceed to language selection)
   *   2 → Human agent (direct transfer)
   *   timeout / invalid → replay the gate menu (one retry, then end call)
   */
  handleGate = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;

      logger.info(
        `Gate: ${sessionId} | DTMF: ${dtmfDigits} | Active: ${isActive}`,
      );

      if (isActive === "0") {
        await this.flushOnCallEnd(
          sessionId,
          webhookData.callerNumber,
          undefined,
          "0",
          IVRState.WELCOME,
        );
        res.status(200).send("");
        return;
      }

      // No input — allow one retry before ending the call
      if (!dtmfDigits?.trim()) {
        const session = sessionManager.getSession(sessionId);
        const retryCount = session?.context?.gateRetryCount ?? 0;

        if (retryCount >= 1) {
          logger.warn(`Gate timeout after retry for ${sessionId}, ending call`);
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.TIMEOUT,
            false,
          );
          const goodbyeAudio = await this.staticAudio("goodbye", "en");
          res.set("Content-Type", "application/xml");
          res.send(
            `<?xml version="1.0" encoding="UTF-8"?><Response>${goodbyeAudio}</Response>`,
          );
          return;
        }

        sessionManager.updateSessionContext(sessionId, {
          gateRetryCount: retryCount + 1,
        });

        // Play "we did not receive your selection" then replay just the options (no greeting)
        const noInputAudio = await this.staticAudio("noInputMessage", "en");
        const gateAudio = staticAudioService.getStaticAudioUrl(
          "en",
          "gateOptions",
        );
        const gateTag = gateAudio
          ? `<Play url="${gateAudio}"/>`
          : `<Say>${staticAudioService.getStaticText("en", "gateOptions")}</Say>`;

        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/gate">
    ${noInputAudio}
    ${gateTag}
  </GetDigits>
</Response>`);
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits ?? "");

      switch (choice) {
        case 1:
          // AI path — proceed to language selection
          logger.info(`Gate: AI path selected for ${sessionId}`);
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.WELCOME,
            IVRState.LANGUAGE_SELECTION,
            dtmfDigits ?? "",
          );
          res.set("Content-Type", "application/xml");
          res.send(await africasTalkingService.generateLanguageMenuResponse());
          break;

        case 2: {
          // Human agent path — check premium subscription first
          logger.info(`Gate: Human agent path selected for ${sessionId}`);

          // Check if user has active premium subscription
          const hasPremium = await this.checkPremiumSubscription(
            webhookData.callerNumber,
          );

          if (!hasPremium) {
            // Non-premium user — play premium required message and end call
            logger.info(
              `Gate: Non-premium user ${webhookData.callerNumber} denied agent access`,
            );
            sessionManager.setTerminationInfo(
              sessionId,
              TerminationReason.COMPLETED_SUCCESSFULLY,
              false,
            );
            const premiumAudio = await this.staticAudio(
              "premiumRequired",
              "en",
            );
            const goodbyeAudio = await this.staticAudio("goodbye", "en");
            res.set("Content-Type", "application/xml");
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${premiumAudio}
  ${goodbyeAudio}
</Response>`);
            return;
          }

          // Premium user — proceed with agent transfer
          sessionManager.bufferAgentTransfer(sessionId);
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.WELCOME,
            IVRState.HUMAN_AGENT_TRANSFER,
            dtmfDigits ?? "",
          );
          res.set("Content-Type", "application/xml");
          res.send(await africasTalkingService.generateTransferResponse("en"));
          break;
        }

        default: {
          // Invalid input — tell the caller, then replay just the options (no greeting)
          logger.warn(
            `Gate: Invalid choice ${choice} for ${sessionId}, replaying menu`,
          );
          const noInputAudio = await this.staticAudio("noInputMessage", "en");
          const gateAudio = staticAudioService.getStaticAudioUrl(
            "en",
            "gateOptions",
          );
          const gateTag = gateAudio
            ? `<Play url="${gateAudio}"/>`
            : `<Say>${staticAudioService.getStaticText("en", "gateOptions")}</Say>`;

          res.set("Content-Type", "application/xml");
          res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/gate">
    ${noInputAudio}
    ${gateTag}
  </GetDigits>
</Response>`);
        }
      }
    } catch (error) {
      logger.error("Error handling gate:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };
  // ─── 2. Language selection ─────────────────────────────────────────────────

  handleLanguageSelection = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;

      logger.info(
        `Language selection: ${sessionId} | DTMF: ${dtmfDigits} | Active: ${isActive}`,
      );

      if (isActive === "0") {
        await this.flushOnCallEnd(
          sessionId,
          webhookData.callerNumber,
          undefined,
          "0",
          IVRState.LANGUAGE_SELECTION,
        );
        res.status(200).send("");
        return;
      }

      // No input — handle timeout (allow one retry before ending the call)
      if (!dtmfDigits?.trim()) {
        const session = sessionManager.getSession(sessionId);
        const timeoutCount = session?.context?.timeoutCount ?? 0;

        if (timeoutCount >= 1) {
          // Second timeout — end the call gracefully
          logger.warn(`Multiple timeouts for ${sessionId}, ending call`);
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.TIMEOUT,
            false,
          );
          const goodbyeAudio = await this.staticAudio("goodbye", "en");
          res.set("Content-Type", "application/xml");
          res.send(
            `<?xml version="1.0" encoding="UTF-8"?><Response>${goodbyeAudio}</Response>`,
          );
          return;
        }

        // Timeout — languageTimeout already says "We did not receive your response.
        // Press 1 for English..." so it covers both the explanation and the menu.
        sessionManager.updateSessionContext(sessionId, {
          timeoutCount: timeoutCount + 1,
        });
        const timeoutAudio = await this.staticAudio("languageTimeout", "en");
        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" callbackUrl="${config.webhook.baseUrl}/voice/language-timeout">
    ${timeoutAudio}
  </GetDigits>
</Response>`);
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits ?? "");
      const ttsAvailable = africasTalkingService.isTTSAvailable();
      let responseXML = "";
      let selectedLanguage = "";

      switch (choice) {
        case 1:
          selectedLanguage = "en";
          responseXML =
            await africasTalkingService.generateDirectRecordingResponse("en");
          break;
        case 2:
          if (ttsAvailable) {
            selectedLanguage = "yo";
            responseXML =
              await africasTalkingService.generateDirectRecordingResponse("yo");
          } else {
            responseXML =
              await africasTalkingService.generateLanguageMenuResponse();
          }
          break;
        case 3:
          if (ttsAvailable) {
            selectedLanguage = "ha";
            responseXML =
              await africasTalkingService.generateDirectRecordingResponse("ha");
          } else {
            responseXML =
              await africasTalkingService.generateLanguageMenuResponse();
          }
          break;
        case 4:
          if (ttsAvailable) {
            selectedLanguage = "ig";
            responseXML =
              await africasTalkingService.generateDirectRecordingResponse("ig");
          } else {
            responseXML =
              await africasTalkingService.generateLanguageMenuResponse();
          }
          break;
        case 5:
          responseXML =
            await africasTalkingService.generateLanguageMenuResponse();
          break;
        case 0: {
          const goodbye = await this.staticAudio("goodbye", "en");
          responseXML = `<?xml version="1.0" encoding="UTF-8"?><Response>${goodbye}</Response>`;
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.COMPLETED_SUCCESSFULLY,
            true,
          );
          break;
        }
        default:
          responseXML =
            await africasTalkingService.generateLanguageMenuResponse();
      }

      // Persist language choice if a valid language was selected
      if (selectedLanguage) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.language = selectedLanguage as "en" | "yo" | "ha" | "ig";
          sessionManager.saveSession(session);
        }
        sessionManager.updateSessionContext(sessionId, {
          language: selectedLanguage,
          timeoutCount: 0,
        });
        sessionManager.updateSessionMenu(sessionId, "recording");
        sessionManager.bufferLanguageSelection(
          sessionId,
          selectedLanguage as "en" | "yo" | "ha" | "ig",
        );
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.LANGUAGE_SELECTION,
          IVRState.RECORDING_PROMPT,
          dtmfDigits ?? "",
        );
        logger.info(`Language selected: ${selectedLanguage} for ${sessionId}`);
      }

      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("Error handling language selection:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  // ─── 3. Language timeout ───────────────────────────────────────────────────

  handleLanguageTimeout = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;

      logger.info(
        `Language timeout: ${sessionId} | DTMF: ${dtmfDigits} | Active: ${isActive}`,
      );

      if (isActive === "0") {
        await this.flushOnCallEnd(
          sessionId,
          webhookData.callerNumber,
          undefined,
          "0",
          IVRState.TIMEOUT,
        );
        res.status(200).send("");
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits ?? "");
      const ttsAvailable = africasTalkingService.isTTSAvailable();

      // Map DTMF choice to language code (same rules as handleLanguageSelection)
      const languageMap: Record<number, string> = { 1: "en" };
      if (ttsAvailable) {
        languageMap[2] = "yo";
        languageMap[3] = "ha";
        languageMap[4] = "ig";
      }
      const selectedLanguage =
        typeof choice === "number" ? languageMap[choice] : undefined;

      if (selectedLanguage) {
        const session = sessionManager.getSession(sessionId);
        if (session) {
          session.language = selectedLanguage as "en" | "yo" | "ha" | "ig";
          sessionManager.saveSession(session);
        }
        sessionManager.updateSessionContext(sessionId, {
          language: selectedLanguage,
          timeoutCount: 0,
        });
        sessionManager.updateSessionMenu(sessionId, "recording");
        sessionManager.bufferLanguageSelection(
          sessionId,
          selectedLanguage as "en" | "yo" | "ha" | "ig",
        );
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.LANGUAGE_SELECTION,
          IVRState.RECORDING_PROMPT,
          dtmfDigits ?? "",
        );

        const responseXML =
          await africasTalkingService.generateDirectRecordingResponse(
            selectedLanguage,
          );
        res.set("Content-Type", "application/xml");
        res.send(responseXML);
      } else {
        // No valid input after second chance — end the call
        logger.warn(
          `No language input after timeout for ${sessionId}, ending call`,
        );
        sessionManager.setTerminationInfo(
          sessionId,
          TerminationReason.TIMEOUT,
          false,
        );
        const goodbyeAudio = await this.staticAudio("goodbye", "en");
        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="3" finishOnKey="#">
    ${goodbyeAudio}
  </GetDigits>
  <Redirect>${config.webhook.baseUrl}/voice/end</Redirect>
</Response>`);
      }
    } catch (error) {
      logger.error("Error handling language timeout:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  // ─── 4. Recording ──────────────────────────────────────────────────────────

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

      // Africa's Talking uses different field names depending on the webhook type
      const recording = recordingUrl || callRecordingUrl;

      logger.info(
        `Recording: ${sessionId} | Active: ${isActive} | URL: ${recording ?? "none"} | Duration: ${callRecordingDurationInSeconds}s`,
      );

      if (isActive === "0") {
        // Call ended during/after recording — still process the audio if we have it
        if (recording) {
          const session = sessionManager.getSession(sessionId);
          const lang = this.getSessionLanguage(session);
          sessionManager.updateSessionContext(sessionId, {
            recordingUrl: recording,
            recordingDuration: callRecordingDurationInSeconds,
          });
          this.processRecordingInBackground(sessionId, recording, lang).catch(
            (err) =>
              logger.error(
                `Background processing failed for ${sessionId}:`,
                err,
              ),
          );
        }
        await this.flushOnCallEnd(
          sessionId,
          webhookData.callerNumber,
          undefined,
          "0",
          IVRState.RECORDING_IN_PROGRESS,
        );
        res.status(200).send("");
        return;
      }

      const session = sessionManager.getSession(sessionId);
      const language = this.getSessionLanguage(session);

      if (!recording) {
        logger.warn(`No recording URL for ${sessionId}`);
        const errorXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.staticAudio("noRecording", language)}
  <Redirect>${config.webhook.baseUrl}/voice/language</Redirect>
</Response>`;
        res.set("Content-Type", "application/xml");
        res.send(errorXML);
        return;
      }

      // Upload the user's recording to Cloudinary in the background (non-blocking)
      let userRecordingUrl: string | undefined;
      try {
        const audioUploadService = (
          await import("../services/audioUploadService")
        ).default;
        userRecordingUrl =
          (await audioUploadService.uploadUserRecording(
            recording,
            sessionId,
          )) ?? undefined;
      } catch (error) {
        logger.warn(`Failed to upload user recording for ${sessionId}:`, error);
      }

      sessionManager.updateSessionContext(sessionId, {
        recordingUrl: recording,
        recordingDuration: callRecordingDurationInSeconds,
        userRecordingUrl,
      });

      // Track state transitions through the recording flow
      sessionManager.bufferStateTransition(
        sessionId,
        IVRState.RECORDING_PROMPT,
        IVRState.RECORDING_IN_PROGRESS,
      );
      sessionManager.bufferStateTransition(
        sessionId,
        IVRState.RECORDING_IN_PROGRESS,
        IVRState.AI_PROCESSING,
      );

      // Start AI processing in the background immediately — the caller hears a
      // "processing" message while we transcribe + query the AI + generate TTS
      this.processRecordingInBackground(sessionId, recording, language).catch(
        (err) => {
          logger.error(`Background processing failed for ${sessionId}:`, err);
          sessionManager.updateSessionContext(sessionId, {
            processingError: true,
          });
        },
      );

      const processingAudio = await this.staticAudio("processing", language);
      const analysisWaitAudio = await this.staticAudio(
        "analysisWait",
        language,
      );

      res.set("Content-Type", "application/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${processingAudio}
  ${analysisWaitAudio}
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`);
    } catch (error) {
      logger.error("Error handling recording:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  // ─── 5. AI processing poll ─────────────────────────────────────────────────

  handleAIProcessing = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session as string;
      const { isActive } = req.body as AfricasTalkingWebhook;

      if (isActive === "0") {
        res.status(200).send("");
        return;
      }

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        logger.error(`No session found: ${sessionId}`);
        res.set("Content-Type", "application/xml");
        res.send(await africasTalkingService.generateErrorResponse());
        return;
      }

      const language = this.getSessionLanguage(session);

      if (session.context.processingError) {
        res.set("Content-Type", "application/xml");
        res.send(await africasTalkingService.generateErrorResponse(language));
        return;
      }

      // AI response is ready — build and send the response XML
      if (session.context.aiReady && session.context.aiResponse) {
        logger.info(`AI ready for ${sessionId}`);
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.AI_PROCESSING,
          IVRState.AI_RESPONSE,
        );

        const audioTag = await this.resolveAIAudioTag(
          session,
          language,
          sessionId,
        );
        const postAIAudio = await this.staticAudio("postAIMenu", language);
        const noInputAudio = await this.staticAudio("noInputMessage", language);

        // Reset wait-message tracking for next interaction
        sessionManager.updateSessionContext(sessionId, {
          aiCheckStartTime: undefined,
          waitMessagePlayed: false,
        });

        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioTag}
  <GetDigits timeout="2" finishOnKey="#" callbackUrl="${config.webhook.baseUrl}/voice/post-ai?language=${language}">
    ${postAIAudio}
  </GetDigits>
  ${noInputAudio}
  <Redirect>${config.webhook.baseUrl}/voice/post-ai?language=${language}</Redirect>
</Response>`);
        return;
      }

      // AI not ready yet — play a wait message after 10 seconds, then keep polling
      if (!session.context.aiCheckStartTime) {
        sessionManager.updateSessionContext(sessionId, {
          aiCheckStartTime: Date.now(),
          waitMessagePlayed: false,
        });
      }

      const elapsed =
        (Date.now() - (session.context.aiCheckStartTime ?? Date.now())) / 1000;
      const waitPlayed = session.context.waitMessagePlayed ?? false;

      if (elapsed >= 10 && !waitPlayed) {
        const waitAudio = await this.staticAudio("wait", language);
        const analysisAudio = await this.staticAudio("analysisWait", language);
        sessionManager.updateSessionContext(sessionId, {
          waitMessagePlayed: true,
        });
        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${waitAudio}
  ${analysisAudio}
  <Pause length="4"/>
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`);
      } else {
        // Silent 4-second pause then re-check
        res.set("Content-Type", "application/xml");
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="4"/>
  <Redirect>${config.webhook.baseUrl}/voice/process-ai?session=${sessionId}</Redirect>
</Response>`);
      }
    } catch (error) {
      logger.error("Error in AI processing poll:", error);
      const session = sessionManager.getSession(req.query.session as string);
      const lang = this.getSessionLanguage(session);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse(lang));
    }
  };

  // ─── 6. Post-AI menu ───────────────────────────────────────────────────────

  handlePostAI = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as AfricasTalkingWebhook;
      const { sessionId, isActive, dtmfDigits } = webhookData;
      const language = ((req.query.language as string) || "en") as
        | "en"
        | "yo"
        | "ha"
        | "ig";

      logger.info(
        `Post-AI: ${sessionId} | DTMF: ${dtmfDigits} | Language: ${language}`,
      );

      if (isActive === "0") {
        await this.flushOnCallEnd(
          sessionId,
          webhookData.callerNumber,
          undefined,
          "0",
          IVRState.POST_AI_MENU,
        );
        res.status(200).send("");
        return;
      }

      // No DTMF yet — this is the initial redirect from handleAIProcessing, show the menu
      if (!dtmfDigits) {
        sessionManager.bufferStateTransition(
          sessionId,
          IVRState.AI_RESPONSE,
          IVRState.POST_AI_MENU,
        );
        res.set("Content-Type", "application/xml");
        res.send(
          await africasTalkingService.generatePostAIMenuResponse(language),
        );
        return;
      }

      const choice = africasTalkingService.extractMenuChoice(dtmfDigits);

      // Buffer the state transition for the chosen action
      switch (choice) {
        case 1:
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.FOLLOW_UP_RECORDING,
            dtmfDigits,
          );
          break;
        case 2:
          sessionManager.bufferAgentTransfer(sessionId);
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.HUMAN_AGENT_TRANSFER,
            dtmfDigits,
          );
          break;
        case 3:
          sessionManager.bufferStateTransition(
            sessionId,
            IVRState.POST_AI_MENU,
            IVRState.WELCOME,
            dtmfDigits,
          );
          break;
        case 0:
          sessionManager.setTerminationInfo(
            sessionId,
            TerminationReason.COMPLETED_SUCCESSFULLY,
            true,
          );
          break;
      }

      let responseXML: string;
      switch (choice) {
        case 1: // Ask another question
          responseXML =
            await africasTalkingService.generateFollowUpRecordingResponse(
              language,
            );
          break;
        case 2: // Speak with a human expert
          responseXML =
            await africasTalkingService.generateTransferResponse(language);
          break;
        case 3: // Back to main menu
          responseXML = await africasTalkingService.generateWelcomeResponse();
          break;
        case 0: // End call
          responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${await this.staticAudio("goodbye", language)}
</Response>`;
          break;
        default: // Invalid input — repeat the menu
          responseXML =
            await africasTalkingService.generatePostAIMenuResponse(language);
      }

      res.set("Content-Type", "application/xml");
      res.send(responseXML);
    } catch (error) {
      logger.error("Error handling post-AI:", error);
      res.set("Content-Type", "application/xml");
      res.send(await africasTalkingService.generateErrorResponse());
    }
  };

  // ─── Background AI processing pipeline ────────────────────────────────────

  /**
   * Runs the full AI pipeline for a voice recording in the background:
   *   1. Transcribe the audio (OpenAI Whisper or ElevenLabs)
   *   2. Query the AI with the transcription (OpenAI GPT-4o-mini)
   *   3. Generate TTS audio for the AI response (Spitch)
   *
   * Results are stored in the session context so handleAIProcessing can
   * pick them up when it polls.
   */
  private async processRecordingInBackground(
    sessionId: string,
    recordingUrl: string,
    language: "en" | "yo" | "ha" | "ig",
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Clear any stale AI state from a previous question in this session
      sessionManager.updateSessionContext(sessionId, {
        preGeneratedAudioTag: undefined,
        ttsGenerating: false,
        aiResponse: undefined,
        aiReady: false,
        ttsGenerationFailed: false,
      });

      // Step 1: Transcribe
      const transcription = await aiService.transcribeAudio(
        recordingUrl,
        language,
      );
      logger.info(
        `Transcribed (${Date.now() - startTime}ms): "${transcription}"`,
      );
      sessionManager.updateSessionContext(sessionId, { transcription });

      // Step 2: AI query
      const aiStartTime = Date.now();
      const aiResult = await aiService.processVeterinaryQuery(transcription, {
        menu: "veterinary_ai",
        farmerId: sessionId,
        language,
        sessionId,
      });
      const aiTime = Date.now() - aiStartTime;

      const cleanedResponse = this.cleanAIResponse(aiResult.response);
      logger.info(`AI response (${aiTime}ms): "${cleanedResponse}"`);

      // Store the AI response and mark it as ready for the polling handler
      sessionManager.addAIInteraction(
        sessionId,
        transcription,
        cleanedResponse,
        0.9,
        "veterinary",
      );
      sessionManager.updateSessionContext(sessionId, {
        aiResponse: cleanedResponse,
        aiReady: true,
      });

      // Buffer the interaction for the engagement flush at call end
      const session = sessionManager.getSession(sessionId);
      sessionManager.bufferAIInteraction(
        sessionId,
        session?.context?.recordingDuration ?? 0,
        { query: transcription, url: session?.context?.userRecordingUrl },
        { response: cleanedResponse },
        aiTime,
        0, // TTS time updated below once generation completes
        language,
        aiResult.confidence,
      );

      // Step 3: TTS — generate in background so it's ready when the poll arrives
      sessionManager.updateSessionContext(sessionId, { ttsGenerating: true });
      const ttsStartTime = Date.now();

      // Set a 20-second safety timeout in case TTS hangs
      const ttsTimeout = setTimeout(() => {
        sessionManager.updateSessionContext(sessionId, {
          ttsGenerating: false,
          ttsGenerationFailed: true,
        });
        logger.error(`TTS timeout after 20s for ${sessionId}`);
      }, 20000);

      this.generateDynamicAudioTag(
        cleanedResponse,
        language,
        session?.callerNumber ?? "unknown",
        sessionId,
      )
        .then((audioTag) => {
          clearTimeout(ttsTimeout);
          const ttsTime = Date.now() - ttsStartTime;
          sessionManager.updateSessionContext(sessionId, {
            preGeneratedAudioTag: audioTag,
            ttsGenerating: false,
          });
          sessionManager.updateLastInteractionTTSTime(sessionId, ttsTime);

          // Extract and store the Cloudinary URL from the Play tag for analytics
          const urlMatch = audioTag.match(/url="([^"]+)"/);
          if (urlMatch?.[1])
            sessionManager.updateLastInteractionAIResponseUrl(
              sessionId,
              urlMatch[1],
            );

          logger.info(`TTS ready (${ttsTime}ms): ${sessionId}`);
        })
        .catch((err) => {
          clearTimeout(ttsTimeout);
          sessionManager.updateSessionContext(sessionId, {
            ttsGenerating: false,
            ttsGenerationFailed: true,
          });
          logger.error(`TTS failed for ${sessionId}:`, err);
        });

      logger.info(
        `Background processing complete (${Date.now() - startTime}ms): ${sessionId}`,
      );
    } catch (error) {
      logger.error(`Background processing error for ${sessionId}:`, error);
      sessionManager.updateSessionContext(sessionId, { processingError: true });
      sessionManager.bufferError(
        sessionId,
        `AI processing error: ${error instanceof Error ? error.message : String(error)}`,
        IVRState.AI_PROCESSING,
        "high",
      );
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolve the audio tag to play for an AI response.
   * Preference order:
   *   1. Pre-generated audio tag (already in session context)
   *   2. Wait for ongoing background TTS generation (up to 40s)
   *   3. Generate on-demand
   *   4. Fall back to <Say> tag
   */
  private async resolveAIAudioTag(
    session: any,
    language: "en" | "yo" | "ha" | "ig",
    sessionId: string,
  ): Promise<string> {
    const aiResponse = session.context.aiResponse as string;

    if (session.context.preGeneratedAudioTag) {
      return session.context.preGeneratedAudioTag;
    }

    if (session.context.ttsGenerating) {
      // Poll for background TTS completion (max 40 seconds)
      const maxWait = 40000;
      const pollInterval = 500;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        const updated = sessionManager.getSession(sessionId);
        if (updated?.context.preGeneratedAudioTag) {
          logger.info(`TTS ready after ${Date.now() - start}ms: ${sessionId}`);
          return updated.context.preGeneratedAudioTag;
        }
        if (!updated?.context.ttsGenerating) break; // generation finished (possibly failed)
      }
    }

    // Generate on-demand as last resort
    logger.info(`Generating TTS on-demand for ${sessionId}`);
    try {
      return await this.generateDynamicAudioTag(
        aiResponse,
        language,
        session.callerNumber ?? "unknown",
        sessionId,
      );
    } catch (error) {
      logger.error(`On-demand TTS failed for ${sessionId}:`, error);
      return `<Say voice="woman">${this.escapeXML(aiResponse)}</Say>`;
    }
  }

  /**
   * Generate a TTS audio tag for dynamic text (AI responses).
   * Returns a <Play url="..."/> tag on success, or a <Say> tag as fallback.
   */
  private async generateDynamicAudioTag(
    text: string,
    language: "en" | "yo" | "ha" | "ig",
    phoneNumber: string,
    sessionId?: string,
  ): Promise<string> {
    const audioUrl = await africasTalkingService.generateTTSAudio(
      text,
      language,
      phoneNumber,
      sessionId,
    );
    if (audioUrl) return `<Play url="${audioUrl}"/>`;
    return `<Say voice="woman">${this.escapeXML(text)}</Say>`;
  }

  /**
   * Return a <Play> or <Say> tag for a pre-generated static audio clip.
   * Falls back to a <Say> tag if the audio URL is not yet available.
   */
  private async staticAudio(
    key: StaticAudioKey,
    language: "en" | "yo" | "ha" | "ig",
  ): Promise<string> {
    const audioUrl = staticAudioService.getStaticAudioUrl(language, key);
    if (audioUrl) return `<Play url="${audioUrl}"/>`;

    // Dynamic fallback — generate on the fly if static audio isn't ready
    const text = staticAudioService.getStaticText(language, key);
    if (!text) return `<Say voice="woman">Please wait.</Say>`;

    try {
      const url = await africasTalkingService.generateTTSAudio(text, language);
      if (url) return `<Play url="${url}"/>`;
    } catch {
      // ignore — fall through to Say tag
    }
    return `<Say voice="woman">${this.escapeXML(text)}</Say>`;
  }

  /**
   * Check if a caller has an active premium subscription.
   * Looks up the user by phone number (trying common Nigerian number formats)
   * and checks subscription.plan === "premium" && subscription.status === "active".
   * Returns false if the user is not found or has a basic/expired subscription.
   */
  private async checkPremiumSubscription(
    callerNumber: string,
  ): Promise<boolean> {
    try {
      // Normalise to the common formats stored in the DB
      const phoneVariants = [
        callerNumber,
        callerNumber.replace(/^\+/, ""), // strip leading +
        callerNumber.replace(/^\+234/, "0"), // +234XXXXXXXXXX → 0XXXXXXXXXX
        callerNumber.replace(/^0/, "+234"), // 0XXXXXXXXXX → +234XXXXXXXXXX
      ];

      const user = await User.findOne(
        { phone: { $in: phoneVariants } },
        { "subscription.plan": 1, "subscription.status": 1 },
      ).lean();

      if (!user) {
        logger.info(
          `Premium check: user not found for ${callerNumber} — denying agent access`,
        );
        return false;
      }

      const sub = (user as any).subscription;
      const isPremium = sub?.plan === "premium" && sub?.status === "active";

      logger.info(
        `Premium check: ${callerNumber} → plan=${sub?.plan ?? "none"}, status=${sub?.status ?? "none"}, allowed=${isPremium}`,
      );
      return isPremium;
    } catch (error) {
      // On DB error, fail closed — don't grant access
      logger.error(`Premium check failed for ${callerNumber}:`, error);
      return false;
    }
  }

  /**
   * Check if the incoming caller has an assigned agent.
   * If so, log the call and return a direct Dial XML response.
   * Otherwise return the normal welcome/language-selection XML.
   *
   * NOTE: Direct agent routing is temporarily disabled — all callers go through
   * the gate menu regardless of agent mapping. Re-enable by uncommenting below.
   */
  private async generateWelcomeWithAgentCheck(
    callerNumber: string,
    sessionId: string,
  ): Promise<string> {
    // const agentNumber = await getAgentForCaller(callerNumber);
    // if (agentNumber) {
    //   logger.info(`Routing ${callerNumber} to agent ${agentNumber}`);
    //   agentCallLogService
    //     .logCall(agentNumber, callerNumber, sessionId)
    //     .catch((err) => logger.error("Failed to log agent call:", err));
    //   return `<?xml version="1.0" encoding="UTF-8"?>
    // <Response>
    //   <Say voice="woman">Please wait while we connect you to your agent.</Say>
    //   <Dial phoneNumbers="${agentNumber}" record="true" />
    // </Response>`;
    // }

    return africasTalkingService.generateWelcomeResponse();
  }

  /**
   * Flush buffered engagement data to the database when a call ends.
   * Called from every handler that receives isActive === "0".
   */
  private async flushOnCallEnd(
    sessionId: string,
    callerNumber: string,
    callEndReason?: string,
    durationInSeconds?: string | number,
    currentState?: string,
  ): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session?.engagementBuffer) return;

    const terminationReason = this.determineTerminationReason(
      callEndReason,
      Number(durationInSeconds),
    );
    const completed =
      terminationReason === TerminationReason.COMPLETED_SUCCESSFULLY;

    sessionManager.setTerminationInfo(sessionId, terminationReason, completed);
    sessionManager.bufferStateTransition(
      sessionId,
      currentState ??
        session.engagementBuffer.currentState ??
        IVRState.CALL_ENDED,
      IVRState.CALL_ENDED,
    );

    const interactions = session.engagementBuffer.aiInteractionsDetailed ?? [];
    logger.info(
      `Call ended: ${sessionId} | ${callerNumber} | ${durationInSeconds}s | ${interactions.length} interactions`,
    );

    // Flush to DB in the background — don't block the HTTP response
    engagementService
      .flushEngagementToDatabase(
        sessionId,
        session.engagementBuffer,
        callerNumber,
        session.startTime,
      )
      .catch((err) => logger.error("Failed to flush engagement data:", err));
  }

  /**
   * Infer the termination reason from the call end data.
   */
  private determineTerminationReason(
    callEndReason?: string,
    duration?: number,
  ): TerminationReason {
    if (!duration || duration < 5) return TerminationReason.NETWORK_ISSUE;

    if (callEndReason) {
      const reason = callEndReason.toLowerCase();
      if (reason.includes("timeout")) return TerminationReason.TIMEOUT;
      if (reason.includes("error") || reason.includes("failed"))
        return TerminationReason.SYSTEM_ERROR;
      if (reason.includes("completed") || reason.includes("success"))
        return TerminationReason.COMPLETED_SUCCESSFULLY;
    }

    return TerminationReason.USER_HANGUP;
  }

  /**
   * Get the language stored in a session, defaulting to English.
   */
  private getSessionLanguage(session: any): "en" | "yo" | "ha" | "ig" {
    return (session?.context?.language ?? session?.language ?? "en") as
      | "en"
      | "yo"
      | "ha"
      | "ig";
  }

  /**
   * Clean an AI response for speech output:
   * - Remove markdown formatting
   * - Remove robotic section labels (Problem:, Solution:, etc.)
   * - Expand common abbreviations
   * - Flatten lists and line breaks into natural sentences
   */
  private cleanAIResponse(response: string): string {
    return (
      response
        // Remove markdown
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/##\s*/g, "")
        .replace(/#\s*/g, "")
        // Remove robotic labels
        .replace(/Problem:\s*/gi, "")
        .replace(/Cause:\s*/gi, "")
        .replace(/Solution:\s*/gi, "")
        .replace(/Prevention:\s*/gi, "To prevent this, ")
        .replace(/When to call vet:\s*/gi, "Call your vet if ")
        // Expand abbreviations for natural speech
        .replace(/Dr\./g, "Doctor")
        .replace(/(\d+)\s*mg/g, "$1 milligrams")
        .replace(/(\d+)\s*ml/g, "$1 milliliters")
        .replace(/(\d+)\s*kg/g, "$1 kilograms")
        .replace(/(\d+)°C/g, "$1 degrees Celsius")
        // Flatten lists and line breaks
        .replace(/\n\s*[\d\-*]\.\s*/g, ". ")
        .replace(/\n\s*[-*]\s*/g, ". ")
        .replace(/\n\s*\n/g, ". ")
        .replace(/\n/g, " ")
        // Clean up punctuation and whitespace
        .replace(/\.\s*\./g, ".")
        .replace(/\s*:\s*/g, ": ")
        .replace(/\s+/g, " ")
        .replace(/\s+\./g, ".")
        .trim()
    );
  }

  /** Escape XML special characters to prevent malformed XML responses. */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

export default new VoiceController();
