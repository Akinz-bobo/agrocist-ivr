import cron from 'node-cron';
import agentFarmerMappingService from '../services/agentFarmerMappingService';
import logger from '../utils/logger';

/**
 * Cron job to sync agent-farmer mappings at configurable intervals
 * Default: Every 6 hours
 * Configure via AGENT_SYNC_CRON_SCHEDULE environment variable
 * Examples:
 *   - '0 *\/6 * * *' = Every 6 hours (default)
 *   - '0 *\/4 * * *' = Every 4 hours
 *   - '0 0 * * *' = Daily at midnight
 *   - '0 *\/1 * * *' = Every hour
 */
export function startAgentFarmerMappingSync() {
  const cronSchedule = process.env.AGENT_SYNC_CRON_SCHEDULE || '0 */6 * * *';
  
  logger.info(`🕒 Scheduling agent-farmer sync with cron: ${cronSchedule}`);
  
  // Validate cron expression
  if (!cron.validate(cronSchedule)) {
    logger.error(`❌ Invalid cron schedule: ${cronSchedule}. Using default: 0 */6 * * *`);
    return startWithSchedule('0 */6 * * *');
  }
  
  startWithSchedule(cronSchedule);
}

function startWithSchedule(schedule: string) {
  cron.schedule(schedule, async () => {
    logger.info('🔄 Starting scheduled agent-farmer mapping sync...');
    try {
      const metrics = await agentFarmerMappingService.syncMappings();
      
      if (metrics.success) {
        logger.info(`✅ Scheduled sync completed successfully`);
      } else {
        logger.error(`❌ Scheduled sync failed with ${metrics.errors.length} errors`);
      }
    } catch (error) {
      const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, '') : 'Unknown error';
      logger.error(`Agent-farmer mapping sync failed: ${sanitizedError}`);
    }
  });

  // Run immediately on startup
  logger.info('🚀 Running initial agent-farmer mapping sync...');
  agentFarmerMappingService.syncMappings()
    .then(metrics => {
      if (metrics.success) {
        logger.info(`✅ Initial sync completed: ${metrics.agentsProcessed} agents, ${metrics.farmersProcessed} farmers`);
      } else {
        logger.error(`❌ Initial sync failed: ${metrics.errors.join(', ')}`);
      }
    })
    .catch(error => {
      const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, '') : 'Unknown error';
      logger.error(`Initial sync failed: ${sanitizedError}`);
    });
}
