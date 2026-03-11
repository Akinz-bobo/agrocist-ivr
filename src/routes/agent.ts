import { Router, Request, Response } from 'express';
import agentController from '../controllers/agentController';
import { logRequest } from '../middleware/validation';
import agentCallLogService from '../services/agentCallLogService';
import agentFarmerMappingService from '../services/agentFarmerMappingService';
import logger from '../utils/logger';

const router = Router();

router.use(logRequest);

// Agent dequeue endpoint - agents call this number to pick calls from their queue
router.post('/dequeue', agentController.handleAgentDequeue);

// Get call logs for an agent
router.get('/call-logs', async (req: Request, res: Response) => {
  try {
    const { phone, page, limit, startDate, endDate, status } = req.query;
    
    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ error: 'Agent phone number is required' });
      return;
    }
    
    const result = await agentCallLogService.getAgentCallLogs(phone, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      status: status as string
    });
    
    res.json({
      success: true,
      agentPhone: phone,
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Manual sync trigger endpoint
router.post('/sync-mappings', async (req: Request, res: Response) => {
  try {
    logger.info('🔄 Manual sync triggered via API');
    const metrics = await agentFarmerMappingService.syncMappings();
    
    res.json({
      success: metrics.success,
      message: metrics.success 
        ? 'Agent-farmer mappings synced successfully' 
        : 'Sync completed with errors',
      metrics: {
        duration: metrics.duration,
        agentsProcessed: metrics.agentsProcessed,
        farmersProcessed: metrics.farmersProcessed,
        errors: metrics.errors,
        timestamp: metrics.endTime
      }
    });
  } catch (error) {
    logger.error('Manual sync failed');
    res.status(500).json({ 
      success: false,
      error: 'Failed to sync mappings' 
    });
  }
});

// Get sync status and metrics
router.get('/sync-status', (req: Request, res: Response) => {
  const metrics = agentFarmerMappingService.getLastSyncMetrics();
  
  if (!metrics) {
    res.json({
      status: 'No sync performed yet',
      lastSync: null
    });
    return;
  }
  
  res.json({
    status: metrics.success ? 'healthy' : 'degraded',
    lastSync: {
      timestamp: metrics.endTime,
      duration: metrics.duration,
      agentsProcessed: metrics.agentsProcessed,
      farmersProcessed: metrics.farmersProcessed,
      errorCount: metrics.errors.length,
      success: metrics.success
    }
  });
});

export default router;
