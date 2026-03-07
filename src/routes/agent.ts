import { Router, Request, Response } from 'express';
import agentController from '../controllers/agentController';
import { logRequest } from '../middleware/validation';
import agentCallLogService from '../services/agentCallLogService';

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

export default router;
