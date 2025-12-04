import { CallSession } from '../types';
import logger from './logger';

class SessionManager {
  private memoryStore: Map<string, CallSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 10 * 60 * 1000);
    
    logger.info('SessionManager initialized with in-memory storage');
  }
  
  createSession(sessionId: string, callerNumber: string): CallSession {
    const session: CallSession = {
      sessionId,
      callerNumber,
      currentMenu: 'welcome',
      language: 'en',
      context: {},
      startTime: new Date(),
      menuHistory: ['welcome'],
      aiInteractions: [],
      // Initialize engagement buffer for local storage
      engagementBuffer: {
        stateTransitions: [],
        dtmfInputs: [],
        aiInteractionsDetailed: [],
        errorRecords: [],
        currentState: 'CALL_INITIATED',
        stateStartTime: new Date()
      }
    };

    this.saveSession(session);
    logger.info(`Created new session: ${sessionId} for caller: ${callerNumber}`);

    return session;
  }
  
  getSession(sessionId: string): CallSession | null {
    return this.memoryStore.get(sessionId) || null;
  }
  
  saveSession(session: CallSession): void {
    this.memoryStore.set(session.sessionId, session);
  }
  
  private cleanupExpiredSessions(): void {
    const oneHourAgo = new Date(Date.now() - 3600000); // 1 hour ago
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.memoryStore.entries()) {
      if (session.startTime < oneHourAgo) {
        this.memoryStore.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }
  
  updateSessionMenu(sessionId: string, menu: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.currentMenu = menu;
      session.menuHistory.push(menu);
      this.saveSession(session);
    }
  }

  updateSessionContext(sessionId: string, contextUpdate: Record<string, any>): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.context = { ...session.context, ...contextUpdate };
      this.saveSession(session);
    }
  }
  
  addAIInteraction(sessionId: string, userInput: string, aiResponse: string, confidence: number, category: 'veterinary' | 'farm_records' | 'products' | 'general'): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.aiInteractions.push({
        userInput,
        aiResponse,
        confidence,
        timestamp: new Date(),
        category
      });
      this.saveSession(session);
    }
  }
  
  deleteSession(sessionId: string): void {
    const deleted = this.memoryStore.delete(sessionId);
    if (deleted) {
      logger.info(`Deleted session: ${sessionId}`);
    }
  }
  
  getAllActiveSessions(): string[] {
    return Array.from(this.memoryStore.keys());
  }
  
  getSessionCount(): number {
    return this.memoryStore.size;
  }
  
  // Buffered engagement tracking methods
  bufferStateTransition(sessionId: string, fromState: string, toState: string, userInput?: string, error?: string): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      const now = new Date();
      const duration = session.engagementBuffer.stateStartTime
        ? now.getTime() - session.engagementBuffer.stateStartTime.getTime()
        : 0;

      const transition: any = {
        fromState,
        toState,
        timestamp: now,
        duration
      };
      if (userInput !== undefined) transition.userInput = userInput;
      if (error !== undefined) transition.error = error;

      session.engagementBuffer.stateTransitions.push(transition);

      session.engagementBuffer.currentState = toState;
      session.engagementBuffer.stateStartTime = now;

      if (userInput && !session.engagementBuffer.dtmfInputs.includes(userInput)) {
        session.engagementBuffer.dtmfInputs.push(userInput);
      }

      this.saveSession(session);
    }
  }

  bufferLanguageSelection(sessionId: string, language: 'en' | 'yo' | 'ha' | 'ig'): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      session.engagementBuffer.selectedLanguage = language;
      session.engagementBuffer.languageSelectionTime = new Date();
      this.saveSession(session);
    }
  }

  bufferAIInteraction(
    sessionId: string,
    userRecordingDuration: number,
    userQuery: { query: string; url?: string },
    aiResponse: { response: string; url?: string },
    aiProcessingTime: number,
    ttsGenerationTime: number,
    language: 'en' | 'yo' | 'ha' | 'ig',
    confidence?: number
  ): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      const interaction: any = {
        timestamp: new Date(),
        userRecordingDuration,
        userQuery,
        aiResponse,
        aiProcessingTime,
        ttsGenerationTime,
        language
      };
      if (confidence !== undefined) interaction.confidence = confidence;

      session.engagementBuffer.aiInteractionsDetailed.push(interaction);
      this.saveSession(session);
    }
  }

  updateLastInteractionTTSTime(sessionId: string, ttsGenerationTime: number): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer && session.engagementBuffer.aiInteractionsDetailed.length > 0) {
      const lastInteraction = session.engagementBuffer.aiInteractionsDetailed[session.engagementBuffer.aiInteractionsDetailed.length - 1];
      if (lastInteraction) {
        lastInteraction.ttsGenerationTime = ttsGenerationTime;
        this.saveSession(session);
      }
    }
  }

  updateLastInteractionAIResponseUrl(sessionId: string, aiResponseUrl: string): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer && session.engagementBuffer.aiInteractionsDetailed.length > 0) {
      const lastInteraction = session.engagementBuffer.aiInteractionsDetailed[session.engagementBuffer.aiInteractionsDetailed.length - 1];
      if (lastInteraction && lastInteraction.aiResponse) {
        lastInteraction.aiResponse.url = aiResponseUrl;
        this.saveSession(session);
      }
    }
  }

  bufferAgentTransfer(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      session.engagementBuffer.wasTransferredToAgent = true;
      session.engagementBuffer.transferRequestTime = new Date();
      this.saveSession(session);
    }
  }

  bufferError(sessionId: string, error: string, state: string, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      session.engagementBuffer.errorRecords.push({
        timestamp: new Date(),
        error,
        state,
        severity
      });
      this.saveSession(session);
    }
  }

  setEngagementMetadata(sessionId: string, metadata: { callId?: string | undefined; userAgent?: string | undefined; ipAddress?: string | undefined; engagementSessionId?: string | undefined }): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      if (metadata.callId !== undefined) session.engagementBuffer.callId = metadata.callId;
      if (metadata.userAgent !== undefined) session.engagementBuffer.userAgent = metadata.userAgent;
      if (metadata.ipAddress !== undefined) session.engagementBuffer.ipAddress = metadata.ipAddress;
      if (metadata.engagementSessionId !== undefined) session.engagementBuffer.engagementSessionId = metadata.engagementSessionId;
      this.saveSession(session);
    }
  }

  setTerminationInfo(sessionId: string, reason: string, completedSuccessfully: boolean): void {
    const session = this.getSession(sessionId);
    if (session && session.engagementBuffer) {
      session.engagementBuffer.terminationReason = reason;
      session.engagementBuffer.completedSuccessfully = completedSuccessfully;
      this.saveSession(session);
    }
  }



  // Get conversation history for AI context
  getConversationHistory(sessionId: string, maxInteractions: number = 3): Array<{userQuery: string, aiResponse: string, timestamp: Date}> {
    const session = this.getSession(sessionId);
    if (!session?.engagementBuffer?.aiInteractionsDetailed) {
      return [];
    }
    
    // Get last N interactions for context
    return session.engagementBuffer.aiInteractionsDetailed
      .slice(-maxInteractions)
      .map(interaction => ({
        userQuery: interaction.userQuery.query,
        aiResponse: interaction.aiResponse.response,
        timestamp: interaction.timestamp
      }));
  }

  // Format conversation context for AI prompt - let AI decide when to use it
  formatConversationContext(sessionId: string): string {
    const history = this.getConversationHistory(sessionId, 3);
    if (history.length === 0) return '';
    
    let context = '\nPrevious conversation in this call:\n';
    history.forEach((interaction, index) => {
      context += `${index + 1}. Farmer asked: ${interaction.userQuery}\n`;
      context += `   You responded: ${interaction.aiResponse}\n`;
    });
    context += '\nRemember: Acknowledge the farmer\'s diverse farming activities warmly when they ask about different animals. Show you remember their previous questions and encourage their farming diversity before answering the current question.\n';
    
    return context;
  }

  // Cleanup method for graceful shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryStore.clear();
    logger.info('SessionManager destroyed');
  }
}

export default new SessionManager();