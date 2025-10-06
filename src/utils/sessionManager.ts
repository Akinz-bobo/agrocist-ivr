import { createClient } from 'redis';
import { CallSession } from '../types';
import config from '../config';
import logger from './logger';

class SessionManager {
  private redisClient;
  
  constructor() {
    this.redisClient = createClient({
      url: config.database.redisUrl
    });
    
    this.redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    this.redisClient.connect();
  }
  
  async createSession(sessionId: string, callerNumber: string): Promise<CallSession> {
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
    
    await this.saveSession(session);
    logger.info(`Created new session: ${sessionId} for caller: ${callerNumber}`);
    
    return session;
  }
  
  async getSession(sessionId: string): Promise<CallSession | null> {
    try {
      const sessionData = await this.redisClient.get(`session:${sessionId}`);
      if (!sessionData) {
        return null;
      }
      
      const session = JSON.parse(sessionData) as CallSession;
      session.startTime = new Date(session.startTime);
      session.aiInteractions = session.aiInteractions.map(interaction => ({
        ...interaction,
        timestamp: new Date(interaction.timestamp)
      }));
      
      return session;
    } catch (error) {
      logger.error(`Error getting session ${sessionId}:`, error);
      return null;
    }
  }
  
  async saveSession(session: CallSession): Promise<void> {
    try {
      await this.redisClient.setEx(
        `session:${session.sessionId}`,
        3600, // 1 hour expiry
        JSON.stringify(session)
      );
    } catch (error) {
      logger.error(`Error saving session ${session.sessionId}:`, error);
    }
  }
  
  async updateSessionMenu(sessionId: string, menu: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.currentMenu = menu;
      session.menuHistory.push(menu);
      await this.saveSession(session);
    }
  }

  async updateSessionContext(sessionId: string, contextUpdate: Record<string, any>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.context = { ...session.context, ...contextUpdate };
      await this.saveSession(session);
    }
  }
  
  async addAIInteraction(sessionId: string, userInput: string, aiResponse: string, confidence: number, category: 'veterinary' | 'farm_records' | 'products' | 'general'): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.aiInteractions.push({
        userInput,
        aiResponse,
        confidence,
        timestamp: new Date(),
        category
      });
      await this.saveSession(session);
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.redisClient.del(`session:${sessionId}`);
      logger.info(`Deleted session: ${sessionId}`);
    } catch (error) {
      logger.error(`Error deleting session ${sessionId}:`, error);
    }
  }
  
  async getAllActiveSessions(): Promise<string[]> {
    try {
      return await this.redisClient.keys('session:*');
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      return [];
    }
  }
}

export default new SessionManager();