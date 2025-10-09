import { Router } from 'express';
import voiceController from '../controllers/voiceController';
import { validateAfricasTalkingWebhook, validateDTMF, logRequest } from '../middleware/validation';

const router = Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Main voice webhook endpoint for incoming calls (no validation to ensure compatibility)
router.post('/', voiceController.handleIncomingCall);

// Language selection endpoint
router.post('/language', voiceController.handleLanguageSelection);

// Recording endpoint for voice input (AI processing)
router.post('/recording', voiceController.handleRecording);

// AI processing endpoint (for polling AI results)
router.post('/process-ai', voiceController.handleAIProcessing);

// Post-AI menu endpoint for human agent option
router.post('/post-ai', voiceController.handlePostAI);

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