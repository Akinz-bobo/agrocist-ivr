import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config';
import logger from './utils/logger';
import database from './utils/database';
import voiceRoutes from './routes/voice';
import analyticsRoutes from './routes/analytics';
import audioPrewarmService from './services/audioPrewarmService';
import staticAudioService from './services/staticAudioService';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/audio', express.static('public/audio'));
app.use('/dashboard', express.static('public'));

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
app.use('/analytics', analyticsRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = database.getStatus();
  const dbHealthy = database.isHealthy();
  
  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    service: 'agrocist-ivr',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    database: {
      connected: dbStatus.connected,
      healthy: dbHealthy,
      readyState: dbStatus.readyState
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Agrocist IVR Service',
    version: '0.1.0',
    description: 'AI-powered livestock farming IVR system with engagement analytics',
    endpoints: {
      voice: '/voice',
      analytics: '/analytics',
      health: '/health'
    },
    analytics: {
      overview: '/analytics/overview',
      patterns: '/analytics/patterns',
      sessions: '/analytics/sessions',
      dashboard: '/analytics/dashboard',
      active: '/analytics/active',
      export: '/analytics/export'
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
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.disconnect();
  process.exit(0);
});

// Start server
const server = app.listen(config.port, async () => {
  logger.info(`Agrocist IVR server starting on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info('Available endpoints:');
  logger.info('  POST /voice - Main voice webhook');
  logger.info('  POST /voice/menu - Menu selections');
  logger.info('  POST /voice/recording - Voice recordings');
  logger.info('  GET /health - Health check');
  logger.info('  GET /analytics/dashboard - Engagement dashboard');
  logger.info('  GET /analytics/overview - Analytics overview');
  logger.info('  GET /analytics/sessions - Recent sessions');
  logger.info('  GET /analytics/patterns - Engagement patterns');

  // Connect to database
  try {
    logger.info('📊 Connecting to MongoDB...');
    await database.connect();
    logger.info('✅ Database connection established');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    logger.warn('⚠️ Continuing without database - engagement metrics will not be saved');
  }

  // Pre-generate static audio files for instant responses
  logger.info('🎵 Starting static audio pre-generation in background...');
  staticAudioService.preGenerateStaticAudio().then(() => {
    logger.info('✅ Static audio pre-generation completed - system ready for ultra-fast responses!');
    
    // Then do the regular audio pre-warming for additional speed
    logger.info('🔥 Starting additional audio pre-warming...');
    return audioPrewarmService.prewarmAudio();
  }).then(() => {
    logger.info('✅ All audio initialization completed - system fully optimized!');
  }).catch((error) => {
    logger.warn('⚠️ Audio initialization failed, but system will continue:', error);
  });
});

export default app;