import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config';
import logger from './utils/logger';
import voiceRoutes from './routes/voice';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static audio files for TTS
app.use('/audio', express.static('public/audio'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/voice', voiceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'agrocist-ivr',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Agrocist IVR Service',
    version: '0.1.0',
    description: 'AI-powered livestock farming IVR system',
    endpoints: {
      voice: '/voice',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Agrocist IVR server starting on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info('Available endpoints:');
  logger.info('  POST /voice - Main voice webhook');
  logger.info('  POST /voice/menu - Menu selections');
  logger.info('  POST /voice/recording - Voice recordings');
  logger.info('  GET /health - Health check');
});

export default app;