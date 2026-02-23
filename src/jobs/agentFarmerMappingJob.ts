import cron from 'node-cron';
import agentFarmerMappingService from '../services/agentFarmerMappingService';
import logger from '../utils/logger';

/**
 * Cron job to sync agent-farmer mappings every 6 hours
 * Schedule: 0 star-slash-6 star star star (At minute 0 past every 6th hour)
 */
export function startAgentFarmerMappingSync() {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('🔄 Starting agent-farmer mapping sync...');
    try {
      await agentFarmerMappingService.syncMappings();
    } catch (error) {
      logger.error('Agent-farmer mapping sync failed:', error);
    }
  });

  // Run immediately on startup
  logger.info('🚀 Running initial agent-farmer mapping sync...');
  agentFarmerMappingService.syncMappings().catch(error => {
    logger.error('Initial sync failed:', error);
  });
}
