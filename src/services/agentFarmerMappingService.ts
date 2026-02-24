import AgentFarmerMapping from "../models/AgentFarmerMapping";
import logger from "../utils/logger";
import mongoose from "mongoose";
import redisClient from "../config/redis";

class AgentFarmerMappingService {
  private readonly CACHE_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly CACHE_PREFIX = "farmer:";

  async syncMappings(): Promise<void> {
    try {
      if (!mongoose.models.User) {
        logger.warn("User model not found - skipping sync");
        return;
      }

      // Clear existing mappings
      await AgentFarmerMapping.deleteMany({});
      logger.info("🗑️ Cleared existing mappings");

      // Clear Redis cache
      const keys = await redisClient.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`🗑️ Cleared ${keys.length} Redis cache entries`);
      }

      const User = mongoose.model("User");
      const agents = await User.find({ role: "agent" })
        .select("phone firstName lastName")
        .lean();

      const pipeline = redisClient.multi();
      let totalFarmers = 0;

      for (const agent of agents) {
        if (!agent.phone) continue;

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
            name: `${f.firstName} ${f.lastName}`.trim(),
          }));

        await AgentFarmerMapping.create({
          agentPhone: agent.phone,
          agentName: `${agent.firstName} ${agent.lastName}`.trim(),
          farmers: farmerData,
          lastSynced: new Date(),
        });

        // Add to Redis pipeline with normalized phone
        for (const farmer of farmerData) {
          const normalized = this.normalizePhone(farmer.phone);
          pipeline.setEx(
            `${this.CACHE_PREFIX}${normalized}`,
            this.CACHE_TTL,
            agent.phone,
          );
          totalFarmers++;
        }
      }

      // Execute all Redis updates at once
      if (totalFarmers > 0) {
        await pipeline.exec();
        logger.info(`💾 Cached ${totalFarmers} farmer-agent mappings in Redis`);
      }

      logger.info(`✅ Synced ${agents.length} agent-farmer mappings`);
    } catch (error) {
      logger.error("Failed to sync agent-farmer mappings:", error);
      throw error;
    }
  }

  private normalizePhone(phone: string): string {
    // Remove + and spaces
    return phone.replace(/[+\s]/g, '');
  }

  async getAgentForFarmer(farmerPhone: string): Promise<string | null> {
    try {
      const normalized = this.normalizePhone(farmerPhone);
      
      // Try Redis with normalized number
      const cached = await redisClient.get(`${this.CACHE_PREFIX}${normalized}`);
      if (cached) return cached;

      // Fallback to MongoDB - try both formats
      let mapping = await AgentFarmerMapping.findOne({
        'farmers.phone': { $in: [farmerPhone, normalized, `+${normalized}`] }
      }).lean();
      
      const agentPhone = mapping?.agentPhone || null;

      if (agentPhone) {
        await redisClient.setEx(
          `${this.CACHE_PREFIX}${normalized}`,
          this.CACHE_TTL,
          agentPhone,
        );
      }

      return agentPhone;
    } catch (error) {
      logger.error("Failed to get agent for farmer:", error);
      return null;
    }
  }
}

export default new AgentFarmerMappingService();
