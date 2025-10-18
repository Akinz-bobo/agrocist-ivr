import EngagementMetrics, {
  IEngagementMetrics,
  IVRState,
  TerminationReason,
  StateTransition,
  AIInteraction
} from '../models/EngagementMetrics';
import Conversation from '../models/Conversation';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface CallSession {
  sessionId: string;
  phoneNumber: string;
  startTime: Date;
  currentState: IVRState;
  stateStartTime: Date;
  selectedLanguage?: 'en' | 'yo' | 'ha' | 'ig';
}

class EngagementService {
  private activeSessions: Map<string, CallSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Session timeout in milliseconds (5 minutes)
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000;

  /**
   * Start tracking a new call session
   */
  async startSession(
    phoneNumber: string, 
    callId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    const sessionId = uuidv4();
    const startTime = new Date();
    
    // Create active session tracker
    const session: CallSession = {
      sessionId,
      phoneNumber,
      startTime,
      currentState: IVRState.CALL_INITIATED,
      stateStartTime: startTime
    };
    
    this.activeSessions.set(sessionId, session);
    
    try {
      // Create database record
      const metrics = new EngagementMetrics({
        sessionId,
        phoneNumber,
        callId,
        callStartTime: startTime,
        currentState: IVRState.CALL_INITIATED,
        terminationTime: startTime, // Will be updated when call ends
        terminationReason: TerminationReason.USER_HANGUP, // Default, will be updated
        userAgent,
        ipAddress,
        stateTransitions: []
      });
      
      await metrics.save();
      
      // Set timeout for automatic cleanup
      this.setSessionTimeout(sessionId);
      
      logger.info(`📊 Started engagement tracking for session: ${sessionId}, phone: ${phoneNumber}`);
      return sessionId;
    } catch (error) {
      logger.error('Failed to start engagement tracking:', error);
      this.activeSessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Track state transition
   */
  async trackStateTransition(
    sessionId: string,
    newState: IVRState,
    userInput?: string,
    error?: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found for state transition: ${sessionId}`);
      return;
    }

    const now = new Date();
    const duration = now.getTime() - session.stateStartTime.getTime();
    
    // Create state transition record
    const transition: StateTransition = {
      fromState: session.currentState,
      toState: newState,
      timestamp: now,
      duration,
      userInput: userInput || undefined,
      error: error || undefined
    };

    try {
      // Update database
      await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            currentState: newState,
            updatedAt: now
          },
          $push: {
            stateTransitions: transition
          },
          $addToSet: {
            dtmfInputs: userInput // Only add if not already present
          }
        }
      );

      // Update active session
      session.currentState = newState;
      session.stateStartTime = now;
      
      // Reset timeout
      this.setSessionTimeout(sessionId);
      
      logger.debug(`📊 State transition: ${sessionId} ${transition.fromState} → ${newState} (${duration}ms)`);
      
      // If error occurred, track it
      if (error) {
        await this.trackError(sessionId, error, newState);
      }
    } catch (dbError) {
      logger.error('Failed to track state transition:', dbError);
    }
  }

  /**
   * Track language selection
   */
  async trackLanguageSelection(
    sessionId: string,
    language: 'en' | 'yo' | 'ha' | 'ig'
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.selectedLanguage = language;
    }

    try {
      await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            selectedLanguage: language,
            languageSelectionTime: new Date()
          }
        }
      );
      
      logger.info(`📊 Language selected: ${sessionId} → ${language}`);
    } catch (error) {
      logger.error('Failed to track language selection:', error);
    }
  }

  /**
   * Track AI interaction
   */
  async trackAIInteraction(
    sessionId: string,
    userRecordingDuration: number,
    userQuery: string,
    aiResponse: string,
    aiProcessingTime: number,
    ttsGenerationTime: number,
    confidence?: number
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    const language = session?.selectedLanguage || 'en';
    
    const interaction: AIInteraction = {
      timestamp: new Date(),
      userRecordingDuration,
      userQuery,
      aiResponse,
      aiProcessingTime,
      ttsGenerationTime,
      language,
      confidence: confidence || undefined
    };

    try {
      const result = await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $push: {
            aiInteractions: interaction
          },
          $inc: {
            totalAIInteractions: 1,
            totalRecordingTime: userRecordingDuration
          }
        },
        { new: true }
      );

      // Calculate average recording length
      if (result) {
        const avgRecordingLength = result.totalRecordingTime / result.totalAIInteractions;
        await EngagementMetrics.findOneAndUpdate(
          { sessionId },
          { $set: { averageRecordingLength: avgRecordingLength } }
        );
      }
      
      logger.info(`📊 AI interaction tracked: ${sessionId} (${userRecordingDuration}s recording, ${aiProcessingTime}ms processing)`);
    } catch (error) {
      logger.error('Failed to track AI interaction:', error);
    }
  }

  /**
   * Track agent transfer request
   */
  async trackAgentTransfer(sessionId: string): Promise<void> {
    try {
      await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            wasTransferredToAgent: true,
            transferRequestTime: new Date()
          }
        }
      );
      
      logger.info(`📊 Agent transfer tracked: ${sessionId}`);
    } catch (error) {
      logger.error('Failed to track agent transfer:', error);
    }
  }

  /**
   * Track errors
   */
  async trackError(
    sessionId: string,
    errorMessage: string,
    currentState: IVRState,
    severity: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    try {
      await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $push: {
            errorRecords: {
              timestamp: new Date(),
              error: errorMessage,
              state: currentState,
              severity
            }
          }
        }
      );
      
      logger.warn(`📊 Error tracked: ${sessionId} - ${errorMessage} (${severity})`);
    } catch (error) {
      logger.error('Failed to track error:', error);
    }
  }

  /**
   * End session with specific termination reason
   */
  async endSession(
    sessionId: string,
    terminationReason: TerminationReason,
    completedSuccessfully: boolean = false
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Session not found for ending: ${sessionId}`);
      return;
    }

    const endTime = new Date();
    const totalDuration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
    
    try {
      // Final state transition if not already ended
      if (session.currentState !== IVRState.CALL_ENDED) {
        await this.trackStateTransition(sessionId, IVRState.CALL_ENDED);
      }

      // Update final metrics
      const updatedMetrics = await EngagementMetrics.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            callEndTime: endTime,
            totalDuration,
            finalState: session.currentState,
            terminationReason,
            terminationTime: endTime,
            completedSuccessfully
          }
        },
        { new: true }
      );

      // Trigger engagement score calculation
      if (updatedMetrics) {
        updatedMetrics.calculateEngagementScore();
        await updatedMetrics.save();
      }

      // Cleanup
      this.activeSessions.delete(sessionId);
      this.clearSessionTimeout(sessionId);
      
      logger.info(`📊 Session ended: ${sessionId} (${totalDuration}s, reason: ${terminationReason}, score: ${updatedMetrics?.engagementScore || 0})`);
    } catch (error) {
      logger.error('Failed to end session:', error);
    }
  }

  /**
   * Handle session timeout
   */
  private async handleSessionTimeout(sessionId: string): Promise<void> {
    logger.warn(`📊 Session timeout: ${sessionId}`);
    await this.endSession(sessionId, TerminationReason.TIMEOUT);
  }

  /**
   * Set session timeout
   */
  private setSessionTimeout(sessionId: string): void {
    // Clear existing timeout
    this.clearSessionTimeout(sessionId);
    
    // Set new timeout
    const timeout = setTimeout(() => {
      this.handleSessionTimeout(sessionId);
    }, this.SESSION_TIMEOUT);
    
    this.sessionTimeouts.set(sessionId, timeout);
  }

  /**
   * Clear session timeout
   */
  private clearSessionTimeout(sessionId: string): void {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  /**
   * Get active session info
   */
  getActiveSession(sessionId: string): CallSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session metrics from database
   */
  async getSessionMetrics(sessionId: string): Promise<IEngagementMetrics | null> {
    try {
      return await EngagementMetrics.findOne({ sessionId });
    } catch (error) {
      logger.error('Failed to get session metrics:', error);
      return null;
    }
  }

  /**
   * Get engagement analytics for a date range
   */
  async getEngagementAnalytics(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const analytics = await EngagementMetrics.getEngagementAnalytics(startDate, endDate);
      return analytics[0] || {};
    } catch (error) {
      logger.error('Failed to get engagement analytics:', error);
      return {};
    }
  }

  /**
   * Get recent sessions with pagination
   */
  async getRecentSessions(
    page: number = 1,
    limit: number = 50,
    phoneNumber?: string
  ): Promise<{ sessions: any[], total: number, pages: number }> {
    try {
      const query: any = {};
      if (phoneNumber) {
        query.phoneNumber = phoneNumber;
      }

      const total = await EngagementMetrics.countDocuments(query);
      const pages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;

      const sessions = await EngagementMetrics.find(query)
        .sort({ callStartTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return { sessions, total, pages };
    } catch (error) {
      logger.error('Failed to get recent sessions:', error);
      return { sessions: [], total: 0, pages: 0 };
    }
  }

  /**
   * Get engagement pattern analysis
   */
  async getEngagementPatterns(): Promise<any> {
    try {
      const pipeline = [
        {
          $group: {
            _id: '$finalState',
            count: { $sum: 1 },
            averageDuration: { $avg: '$totalDuration' },
            averageEngagementScore: { $avg: '$engagementScore' }
          }
        },
        {
          $sort: { count: -1 as const }
        }
      ];

      const statePatterns = await EngagementMetrics.aggregate(pipeline);

      // Get termination reason patterns
      const terminationPipeline = [
        {
          $group: {
            _id: '$terminationReason',
            count: { $sum: 1 },
            percentage: { $avg: 1 } // Will calculate percentage later
          }
        }
      ];

      const terminationPatterns = await EngagementMetrics.aggregate(terminationPipeline);
      
      // Get language preferences
      const languagePipeline = [
        {
          $match: { selectedLanguage: { $exists: true } }
        },
        {
          $group: {
            _id: '$selectedLanguage',
            count: { $sum: 1 },
            averageEngagementScore: { $avg: '$engagementScore' }
          }
        }
      ];

      const languagePatterns = await EngagementMetrics.aggregate(languagePipeline);

      return {
        statePatterns,
        terminationPatterns,
        languagePatterns,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to get engagement patterns:', error);
      return {};
    }
  }

  /**
   * Cleanup old sessions (for maintenance)
   */
  async cleanupOldSessions(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await EngagementMetrics.deleteMany({
        callStartTime: { $lt: cutoffDate }
      });

      logger.info(`📊 Cleaned up ${result.deletedCount} old engagement records`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old sessions:', error);
      return 0;
    }
  }

  /**
   * Flush buffered engagement data to database (called when call ends)
   * This writes all tracked data in one batch operation
   */
  async flushEngagementToDatabase(sessionId: string, engagementBuffer: any, phoneNumber: string, startTime: Date): Promise<void> {
    try {
      const endTime = new Date();
      const totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      // Extract interactions from engagement buffer
      const interactions = (engagementBuffer.aiInteractionsDetailed || []).map((interaction: any) => ({
        userQuery: interaction.userQuery || '',
        aiResponse: interaction.aiResponse || '',
        timestamp: interaction.timestamp || new Date()
      }));

      // Create simplified conversation document
      const conversation = new Conversation({
        sessionId,
        phoneNumber,
        language: engagementBuffer.selectedLanguage || 'en',
        callStartTime: startTime,
        callEndTime: endTime,
        duration: totalDuration,
        interactions
      });

      // Save to database
      await conversation.save();

      logger.info(`💾 Saved conversation to database: ${sessionId}`);
      logger.info(`📞 Session: ${phoneNumber} | Language: ${conversation.language} | Duration: ${totalDuration}s`);
      logger.info(`💬 Interactions: ${interactions.length}`);

      // Log each interaction
      interactions.forEach((interaction: any, index: number) => {
        logger.info(`  [${index + 1}] User: "${interaction.userQuery}"`);
        logger.info(`      AI: "${interaction.aiResponse}"`);
      });

    } catch (error) {
      logger.error(`Failed to flush engagement data for session ${sessionId}:`, error);
      // Don't throw - we don't want to block call termination if DB write fails
    }
  }
}

export default new EngagementService();