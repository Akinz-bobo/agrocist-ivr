import { CallSession } from "../types";
import logger from "./logger";

// Sessions older than 1 hour are considered expired and cleaned up
const SESSION_TTL_MS = 60 * 60 * 1000;

// Cleanup runs every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Manages in-memory call sessions for the duration of each IVR call.
 *
 * All engagement data is buffered in the session's `engagementBuffer` and
 * written to MongoDB in a single flush when the call ends (see engagementService).
 * This avoids per-event database writes during the call.
 */
class SessionManager {
  private store: Map<string, CallSession> = new Map();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupExpiredSessions(), CLEANUP_INTERVAL_MS);
    logger.info("SessionManager initialized");
  }

  // ─── Session lifecycle ─────────────────────────────────────────────────────

  /** Create and store a new session for an incoming call. */
  createSession(sessionId: string, callerNumber: string): CallSession {
    const session: CallSession = {
      sessionId,
      callerNumber,
      currentMenu: "welcome",
      language: "en",
      context: {},
      startTime: new Date(),
      menuHistory: ["welcome"],
      aiInteractions: [],
      engagementBuffer: {
        stateTransitions: [],
        dtmfInputs: [],
        aiInteractionsDetailed: [],
        errorRecords: [],
        currentState: "CALL_INITIATED",
        stateStartTime: new Date(),
      },
    };

    this.store.set(sessionId, session);
    logger.info(`Session created: ${sessionId} for ${callerNumber}`);
    return session;
  }

  getSession(sessionId: string): CallSession | null {
    return this.store.get(sessionId) ?? null;
  }

  saveSession(session: CallSession): void {
    this.store.set(session.sessionId, session);
  }

  deleteSession(sessionId: string): void {
    if (this.store.delete(sessionId)) {
      logger.info(`Session deleted: ${sessionId}`);
    }
  }

  getAllActiveSessions(): string[] {
    return Array.from(this.store.keys());
  }

  getSessionCount(): number {
    return this.store.size;
  }

  // ─── Session state helpers ─────────────────────────────────────────────────

  /** Update the current menu and append it to the navigation history. */
  updateSessionMenu(sessionId: string, menu: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.currentMenu = menu;
      session.menuHistory.push(menu);
      this.saveSession(session);
    }
  }

  /** Merge additional key-value pairs into the session's free-form context object. */
  updateSessionContext(sessionId: string, update: Record<string, any>): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.context = { ...session.context, ...update };
      this.saveSession(session);
    }
  }

  /** Append an AI interaction to the session's lightweight interaction list. */
  addAIInteraction(
    sessionId: string,
    userInput: string,
    aiResponse: string,
    confidence: number,
    category: "veterinary" | "farm_records" | "products" | "general"
  ): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.aiInteractions.push({ userInput, aiResponse, confidence, timestamp: new Date(), category });
      this.saveSession(session);
    }
  }

  // ─── Engagement buffer helpers ─────────────────────────────────────────────
  // These methods accumulate call data in memory. The buffer is flushed to
  // MongoDB once via engagementService.flushEngagementToDatabase() when the call ends.

  /** Record a state transition in the engagement buffer. */
  bufferStateTransition(
    sessionId: string,
    fromState: string,
    toState: string,
    userInput?: string,
    error?: string
  ): void {
    const session = this.getSession(sessionId);
    if (!session?.engagementBuffer) return;

    const buf = session.engagementBuffer;
    const now = new Date();
    const duration = buf.stateStartTime ? now.getTime() - buf.stateStartTime.getTime() : 0;

    const transition: any = { fromState, toState, timestamp: now, duration };
    if (userInput !== undefined) transition.userInput = userInput;
    if (error !== undefined) transition.error = error;

    buf.stateTransitions.push(transition);
    buf.currentState = toState;
    buf.stateStartTime = now;

    // Track unique DTMF inputs
    if (userInput && !buf.dtmfInputs.includes(userInput)) {
      buf.dtmfInputs.push(userInput);
    }

    this.saveSession(session);
  }

  /** Record the caller's language selection in the engagement buffer. */
  bufferLanguageSelection(sessionId: string, language: "en" | "yo" | "ha" | "ig"): void {
    const session = this.getSession(sessionId);
    if (session?.engagementBuffer) {
      session.engagementBuffer.selectedLanguage = language;
      session.engagementBuffer.languageSelectionTime = new Date();
      this.saveSession(session);
    }
  }

  /** Record a full AI interaction (query + response + timing) in the engagement buffer. */
  bufferAIInteraction(
    sessionId: string,
    userRecordingDuration: number,
    userQuery: { query: string; url?: string },
    aiResponse: { response: string; url?: string },
    aiProcessingTime: number,
    ttsGenerationTime: number,
    language: "en" | "yo" | "ha" | "ig",
    confidence?: number
  ): void {
    const session = this.getSession(sessionId);
    if (!session?.engagementBuffer) return;

    const interaction: any = {
      timestamp: new Date(),
      userRecordingDuration,
      userQuery,
      aiResponse,
      aiProcessingTime,
      ttsGenerationTime,
      language,
    };
    if (confidence !== undefined) interaction.confidence = confidence;

    session.engagementBuffer.aiInteractionsDetailed.push(interaction);
    this.saveSession(session);
  }

  /** Update the TTS generation time on the most recent AI interaction. */
  updateLastInteractionTTSTime(sessionId: string, ttsGenerationTime: number): void {
    const session = this.getSession(sessionId);
    const interactions = session?.engagementBuffer?.aiInteractionsDetailed;
    if (interactions?.length) {
      interactions[interactions.length - 1]!.ttsGenerationTime = ttsGenerationTime;
      this.saveSession(session!);
    }
  }

  /** Update the AI response audio URL on the most recent AI interaction. */
  updateLastInteractionAIResponseUrl(sessionId: string, aiResponseUrl: string): void {
    const session = this.getSession(sessionId);
    const interactions = session?.engagementBuffer?.aiInteractionsDetailed;
    if (interactions?.length) {
      const last = interactions[interactions.length - 1]!;
      if (last.aiResponse) {
        last.aiResponse.url = aiResponseUrl;
        this.saveSession(session!);
      }
    }
  }

  /** Mark that the caller requested an agent transfer. */
  bufferAgentTransfer(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session?.engagementBuffer) {
      session.engagementBuffer.wasTransferredToAgent = true;
      session.engagementBuffer.transferRequestTime = new Date();
      this.saveSession(session);
    }
  }

  /** Record an error event in the engagement buffer. */
  bufferError(
    sessionId: string,
    error: string,
    state: string,
    severity: "low" | "medium" | "high" = "medium"
  ): void {
    const session = this.getSession(sessionId);
    if (session?.engagementBuffer) {
      session.engagementBuffer.errorRecords.push({ timestamp: new Date(), error, state, severity });
      this.saveSession(session);
    }
  }

  /** Store call metadata (callId, userAgent, IP) in the engagement buffer. */
  setEngagementMetadata(
    sessionId: string,
    metadata: {
      callId?: string;
      userAgent?: string;
      ipAddress?: string;
      engagementSessionId?: string;
    }
  ): void {
    const session = this.getSession(sessionId);
    if (!session?.engagementBuffer) return;

    const buf = session.engagementBuffer;
    if (metadata.callId !== undefined) buf.callId = metadata.callId;
    if (metadata.userAgent !== undefined) buf.userAgent = metadata.userAgent;
    if (metadata.ipAddress !== undefined) buf.ipAddress = metadata.ipAddress;
    if (metadata.engagementSessionId !== undefined) buf.engagementSessionId = metadata.engagementSessionId;
    this.saveSession(session);
  }

  /** Record how the call ended (reason + success flag) in the engagement buffer. */
  setTerminationInfo(sessionId: string, reason: string, completedSuccessfully: boolean): void {
    const session = this.getSession(sessionId);
    if (session?.engagementBuffer) {
      session.engagementBuffer.terminationReason = reason;
      session.engagementBuffer.completedSuccessfully = completedSuccessfully;
      this.saveSession(session);
    }
  }

  // ─── Conversation context for AI ──────────────────────────────────────────

  /**
   * Return the last N AI interactions as a formatted string for inclusion in
   * the AI system prompt, giving the model conversation memory within a call.
   */
  formatConversationContext(sessionId: string, maxInteractions: number = 3): string {
    const session = this.getSession(sessionId);
    const history = session?.engagementBuffer?.aiInteractionsDetailed?.slice(-maxInteractions);
    if (!history?.length) return "";

    let context = "\nPrevious conversation in this call:\n";
    history.forEach((item, i) => {
      context += `${i + 1}. Farmer asked: ${item.userQuery.query}\n`;
      context += `   You responded: ${item.aiResponse.response}\n`;
    });
    context +=
      "\nRemember: Acknowledge the farmer's diverse farming activities warmly when they ask about different animals. Show you remember their previous questions and encourage their farming diversity before answering the current question.\n";

    return context;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /** Remove sessions that have been inactive for longer than SESSION_TTL_MS. */
  private cleanupExpiredSessions(): void {
    const cutoff = new Date(Date.now() - SESSION_TTL_MS);
    let count = 0;

    for (const [id, session] of this.store.entries()) {
      if (session.startTime < cutoff) {
        this.store.delete(id);
        count++;
      }
    }

    if (count > 0) logger.info(`Cleaned up ${count} expired sessions`);
  }

  /** Stop the cleanup timer and clear all sessions (used on graceful shutdown). */
  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
    logger.info("SessionManager destroyed");
  }
}

export default new SessionManager();
