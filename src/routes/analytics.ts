import { Router, Request, Response } from 'express';
import engagementService from '../services/engagementService';
import database from '../utils/database';
import logger from '../utils/logger';

const router = Router();

/**
 * Get engagement analytics overview
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const analytics = await (engagementService as any).getEngagementAnalytics(start, end);
    
    res.json({
      success: true,
      data: analytics,
      dateRange: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get engagement analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

/**
 * Get engagement patterns analysis
 */
router.get('/patterns', async (req: Request, res: Response) => {
  try {
    const patterns = await (engagementService as any).getEngagementPatterns();
    
    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    logger.error('Failed to get engagement patterns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve patterns'
    });
  }
});

/**
 * Get recent sessions with pagination
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', phoneNumber } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const phone = phoneNumber ? String(phoneNumber) : undefined;
    
    const result = await (engagementService as any).getRecentSessions(pageNum, limitNum, phone);
    
    res.json({
      success: true,
      data: result.sessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: result.pages
      }
    });
  } catch (error) {
    logger.error('Failed to get recent sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sessions'
    });
  }
});

/**
 * Get detailed session information
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = await (engagementService as any).getSessionMetrics(String(sessionId));
    
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Failed to get session details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session details'
    });
  }
});

/**
 * Get active sessions
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const activeSessions = (engagementService as any).getActiveSessions();
    
    res.json({
      success: true,
      data: {
        count: activeSessions.length,
        sessions: activeSessions
      }
    });
  } catch (error) {
    logger.error('Failed to get active sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active sessions'
    });
  }
});

/**
 * Get system health including database status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbStatus = database.getStatus();
    const dbStats = await database.getStats();
    const dbHealthy = database.isHealthy();
    
    res.json({
      success: true,
      data: {
        database: {
          connected: dbStatus.connected,
          healthy: dbHealthy,
          readyState: dbStatus.readyState,
          host: dbStatus.host,
          name: dbStatus.name,
          stats: dbStats
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health'
    });
  }
});

/**
 * Get dashboard statistics for quick overview
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Get today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get this week's data  
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    // Get this month's data
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [
      todayAnalytics,
      weekAnalytics,
      monthAnalytics,
      overallPatterns,
      activeSessions
    ] = await Promise.all([
      (engagementService as any).getEngagementAnalytics(today, tomorrow),
      (engagementService as any).getEngagementAnalytics(weekStart, tomorrow),
      (engagementService as any).getEngagementAnalytics(monthStart, tomorrow),
      (engagementService as any).getEngagementPatterns(),
      (engagementService as any).getActiveSessions()
    ]);
    
    res.json({
      success: true,
      data: {
        today: todayAnalytics,
        thisWeek: weekAnalytics,
        thisMonth: monthAnalytics,
        patterns: overallPatterns,
        activeSessions: {
          count: activeSessions.length,
          sessions: activeSessions
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

/**
 * Search sessions by phone number or date range
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, startDate, endDate, page = 1, limit = 50 } = req.body;
    
    // For now, we'll use the existing getRecentSessions with phone filter
    // This can be enhanced to support more complex queries
    const result = await (engagementService as any).getRecentSessions(
      page, 
      limit, 
      phoneNumber
    );
    
    res.json({
      success: true,
      data: result.sessions,
      pagination: {
        page,
        limit,
        total: result.total,
        pages: result.pages
      },
      searchCriteria: {
        phoneNumber,
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error('Failed to search sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search sessions'
    });
  }
});

/**
 * Export analytics data as CSV
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const result = await (engagementService as any).getRecentSessions(1, 1000); // Get up to 1000 records
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'Session ID',
        'Phone Number', 
        'Call Start Time',
        'Call End Time',
        'Duration (seconds)',
        'Selected Language',
        'Final State',
        'Termination Reason',
        'AI Interactions',
        'Engagement Score',
        'Completed Successfully'
      ].join(',');
      
      // Build CSV rows from result.sessions (avoid duplicating router and types)
      const csvRows = result.sessions.map((session: any) => [
        session.sessionId || '',
        session.phoneNumber || '',
        session.callStartTime instanceof Date ? session.callStartTime.toISOString() : (session.callStartTime ? String(session.callStartTime) : ''),
        session.callEndTime instanceof Date ? session.callEndTime.toISOString() : (session.callEndTime ? String(session.callEndTime) : ''),
        session.totalDuration ?? 0,
        session.selectedLanguage || '',
        session.finalState || '',
        session.terminationReason || '',
        session.totalAIInteractions ?? 0,
        session.engagementScore ?? 0,
        session.completedSuccessfully ? 'Yes' : 'No'
      ].join(',')).join('\n');
      
      const csvContent = csvHeaders + '\n' + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="engagement_metrics_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: result.sessions,
        exportedAt: new Date().toISOString(),
        count: result.sessions.length
      });
    }
  } catch (error) {
    logger.error('Failed to export analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics'
    });
  }
});

/**
 * Cleanup old engagement data
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 30 } = req.body;
    
    const deletedCount = typeof (engagementService as any).cleanupOldSessions === 'function'
      ? await (engagementService as any).cleanupOldSessions(olderThanDays)
      : 0;
    
    res.json({
      success: true,
      data: {
        deletedCount,
        olderThanDays,
        cleanupDate: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to cleanup old data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup old data'
    });
  }
});

export default router;