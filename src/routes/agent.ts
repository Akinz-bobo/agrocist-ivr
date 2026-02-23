import { Router } from 'express';
import agentController from '../controllers/agentController';
import { logRequest } from '../middleware/validation';

const router = Router();

router.use(logRequest);

// Agent dequeue endpoint - agents call this number to pick calls from their queue
router.post('/dequeue', agentController.handleAgentDequeue);

export default router;
