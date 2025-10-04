import { Router } from 'express';
import voiceController from '../controllers/voiceController';
import { validateAfricasTalkingWebhook, validateDTMF, logRequest } from '../middleware/validation';

const router = Router();

// Apply logging middleware to all routes
router.use(logRequest);

// Main voice webhook endpoint for incoming calls
router.post('/', validateAfricasTalkingWebhook, voiceController.handleIncomingCall);

// Menu selection endpoints
router.post('/menu', validateAfricasTalkingWebhook, validateDTMF, voiceController.handleMenuSelection);
router.post('/products', validateAfricasTalkingWebhook, validateDTMF, voiceController.handleProductMenu);
router.post('/veterinary', validateAfricasTalkingWebhook, validateDTMF, voiceController.handleVeterinaryMenu);

// Recording endpoint for voice input
router.post('/recording', validateAfricasTalkingWebhook, voiceController.handleRecording);

// Transfer completion endpoint
router.post('/transfer', validateAfricasTalkingWebhook, voiceController.handleTransfer);

// Call end notification endpoint
router.post('/end', validateAfricasTalkingWebhook, voiceController.handleCallEnd);

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