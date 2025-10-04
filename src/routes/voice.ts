import { Router } from 'express';
import voiceController from '../controllers/voiceController';
import { validateAfricasTalkingWebhook, validateDTMF, logRequest } from '../middleware/validation';

const router = Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Main voice webhook endpoint for incoming calls (no validation to ensure compatibility)
router.post('/', voiceController.handleIncomingCall);

// Menu selection endpoints
router.post('/menu', voiceController.handleMenuSelection);

// Simplified endpoints - other handlers temporarily disabled

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'agrocist-ivr',
    version: '0.1.0',
    timestamp: new Date().toISOString()
  });
});

export default router;