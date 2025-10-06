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
      aiInteractions: []
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