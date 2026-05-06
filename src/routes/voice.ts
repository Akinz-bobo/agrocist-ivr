import { Router } from 'express';
import voiceController from '../controllers/voiceController';
import { validateAfricasTalkingWebhook, validateDTMF, logRequest } from '../middleware/validation';

const router = Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Main voice webhook endpoint for incoming calls (no validation to ensure compatibility)
router.post('/', voiceController.handleIncomingCall);

// Gate menu endpoint — caller chooses AI assistant (1) or human agent (2)
router.post('/gate', voiceController.handleGate);

// Language selection endpoint (reached after choosing the AI path at the gate)
router.post('/language', voiceController.handleLanguageSelection);

// Language timeout endpoint (for handling timeout on language selection)
router.post('/language-timeout', voiceController.handleLanguageTimeout);

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