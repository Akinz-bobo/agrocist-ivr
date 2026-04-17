import AgentFarmerMapping from "../models/AgentFarmerMapping";
import logger from "../utils/logger";
import mongoose from "mongoose";
import redisClient, { isRedisReady } from "../config/redis";

interface SyncMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  agentsProcessed: number;
  farmersProcessed: number;
  errors: string[];
  success: boolean;
}

class AgentFarmerMappingService {
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly CACHE_PREFIX = "farmer:";
  private readonly SYNC_LOCK_KEY = "sync:agent-farmer:lock";
  private readonly SYNC_LOCK_TTL = 600; // 10 minutes
  private lastSyncMetrics: SyncMetrics | null = null;

  /**
   * Sync agent-farmer mappings with atomic operations and rollback safety
   */
  async syncMappings(): Promise<SyncMetrics> {
    const metrics: SyncMetrics = {
      startTime: new Date(),
      agentsProcessed: 0,
      farmersProcessed: 0,
      errors: [],
      success: false
    };

    // Acquire distributed lock to prevent concurrent syncs
    if (!isRedisReady()) {
      const error = 'Redis not connected, skipping sync';
      logger.warn(`⚠️ ${error}`);
      metrics.errors.push(error);
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      return metrics;
    }

    const lockAcquired = await redisClient.set(
      this.SYNC_LOCK_KEY,
      Date.now().toString(),
      { NX: true, EX: this.SYNC_LOCK_TTL }
    );

    if (!lockAcquired) {
      const error = 'Sync already in progress';
      logger.warn(`⚠️ ${error}`);
      metrics.errors.push(error);
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      return metrics;
    }

    try {
      if (!mongoose.models.User) {
        throw new Error('User model not found');
      }

      const User = mongoose.model("User");
      const agents = await User.find({ role: "agent" })
        .select("phone firstName lastName")
        .lean();

      logger.info(`🔄 Syncing ${agents.length} agents...`);

      const redisPipeline = redisClient.multi();
      const processedFarmerPhones = new Set<string>();

      for (const agent of agents) {
        if (!agent.phone) {
          metrics.errors.push(`Agent ${agent._id} has no phone number`);
          continue;
        }

        try {
          const farmers = await User.find({
            role: "farmer",
            referredBy: agent._id,
          })
            .select("phone firstName lastName")
            .lean();

          const farmerData = farmers
            .filter((f) => f.phone)
            .map((f) => ({
              phone: f.phone,
              name: `${f.firstName || ''} ${f.lastName || ''}`.trim(),
            }));

          // Atomic upsert - keeps old data if this fails
          await AgentFarmerMapping.findOneAndUpdate(
            { agentPhone: agent.phone },
            {
              agentPhone: agent.phone,
              agentName: `${agent.firstName || ''} ${agent.lastName || ''}`.trim(),
              farmers: farmerData,
              lastSynced: new Date(),
            },
            { upsert: true, new: true }
          );

          // Add to Redis pipeline
          for (const farmer of farmerData) {
            const normalized = this.normalizePhone(farmer.phone);
            redisPipeline.setEx(
              `${this.CACHE_PREFIX}${normalized}`,
              this.CACHE_TTL,
              agent.phone
            );
            processedFarmerPhones.add(normalized);
            metrics.farmersProcessed++;
          }

          metrics.agentsProcessed++;
        } catch (error) {
          const errorMsg = `Failed to process agent ${agent.phone}: ${error instanceof Error ? error.message : String(error)}`;
          metrics.errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Execute all Redis updates
      if (metrics.farmersProcessed > 0) {
        await redisPipeline.exec();
        logger.info(`💾 Cached ${metrics.farmersProcessed} farmer-agent mappings in Redis`);
      }

      // Clean up stale Redis entries using SCAN (non-blocking)
      await this.cleanupStaleCache(processedFarmerPhones);

      metrics.success = true;
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      this.lastSyncMetrics = metrics;

      logger.info(`✅ Sync completed: ${metrics.agentsProcessed} agents, ${metrics.farmersProcessed} farmers in ${metrics.duration}ms`);
      
      if (metrics.errors.length > 0) {
        logger.warn(`⚠️ Sync completed with ${metrics.errors.length} errors`);
      }

      return metrics;
    } catch (error) {
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      metrics.errors.push(errorMsg);
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      logger.error(errorMsg, error);
      return metrics;
    } finally {
      // Release lock
      await redisClient.del(this.SYNC_LOCK_KEY);
    }
  }

  /**
   * Clean up stale cache entries using SCAN (non-blocking)
   */
  private async cleanupStaleCache(validPhones: Set<string>): Promise<void> {
    try {
      let deletedCount = 0;
      const batchSize = 100;

      // Use scanIterator for simpler iteration
      for await (const key of redisClient.scanIterator({
        MATCH: `${this.CACHE_PREFIX}*`,
        COUNT: batchSize
      })) {
        const keyStr = typeof key === 'string' ? key : String(key);
        const phone = keyStr.replace(this.CACHE_PREFIX, '');
        if (!validPhones.has(phone)) {
          await redisClient.del(keyStr);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`🗑️ Cleaned up ${deletedCount} stale cache entries`);
      }
    } catch (error) {
      logger.error('Failed to cleanup stale cache:', error);
    }
  }

  /**
   * Get agent phone for a farmer (with Redis cache)
   */
  async getAgentForFarmer(farmerPhone: string): Promise<string | null> {
    try {
      const normalized = this.normalizePhone(farmerPhone);
      
      // Try Redis with normalized number (only if connected)
      if (isRedisReady()) {
        const cached = await redisClient.get(`${this.CACHE_PREFIX}${normalized}`);
        if (cached) {
          logger.debug(`Cache hit for farmer: ${this.sanitizePhone(farmerPhone)}`);
          return cached;
        }
      }

      // Fallback to MongoDB - try both formats
      logger.debug(`Cache miss for farmer: ${this.sanitizePhone(farmerPhone)}, querying MongoDB`);
      const mapping = await AgentFarmerMapping.findOne({
        'farmers.phone': { $in: [farmerPhone, normalized, `+${normalized}`] }
      }).lean();
      
      const agentPhone = mapping?.agentPhone || null;

      if (agentPhone && isRedisReady()) {
        await redisClient.setEx(
          `${this.CACHE_PREFIX}${normalized}`,
          this.CACHE_TTL,
          agentPhone,
        );
      }

      return agentPhone;
    } catch (error) {
      logger.error('Failed to get agent for farmer');
      return null;
    }
  }

  /**
   * Get last sync metrics
   */
  getLastSyncMetrics(): SyncMetrics | null {
    return this.lastSyncMetrics;
  }

  /**
   * Invalidate cache for a specific farmer
   */
  async invalidateCache(farmerPhone: string): Promise<void> {
    try {
      const normalized = this.normalizePhone(farmerPhone);
      await redisClient.del(`${this.CACHE_PREFIX}${normalized}`);
      logger.info(`Cache invalidated for farmer: ${this.sanitizePhone(farmerPhone)}`);
    } catch (error) {
      logger.error('Failed to invalidate cache');
    }
  }

  /**
   * Normalize phone number (remove + and spaces)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[+\s]/g, '');
  }

  /**
   * Sanitize phone for logging (prevent log injection)
   */
  private sanitizePhone(phone: string): string {
    return phone.replace(/[\r\n]/g, '');
  }
}

export default new AgentFarmerMappingService();
