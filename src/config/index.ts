import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Africa's Talking
  africasTalking: {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || '',
    shortCode: process.env.AT_SHORT_CODE || '',
  },
  
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
  
  // Database
  database: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/agrocist-ivr',
  },
  
  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  // Webhook
  webhook: {
    baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',
  },
  
  // Agent
  agent: {
    phoneNumber: process.env.AGENT_PHONE_NUMBER || '+234XXXXXXXXXX',
    availableHours: process.env.AGENT_AVAILABLE_HOURS || '09:00-17:00',
  },
  
  // AI
  ai: {
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.7'),
    maxRecordingDuration: parseInt(process.env.MAX_RECORDING_DURATION || '30'),
  },
};

export default config;