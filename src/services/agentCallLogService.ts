import AgentCallLog from '../models/AgentCallLog';
import AgentFarmerMapping from '../models/AgentFarmerMapping';
import logger from '../utils/logger';

class AgentCallLogService {
  /**
   * Log a farmer call to an agent
   */
  async logCall(
    agentPhone: string,
    farmerPhone: string,
    sessionId: string
  ): Promise<void> {
    try {
      // Get agent and farmer names from mapping
      const mapping = await AgentFarmerMapping.findOne({
        agentPhone,
        'farmers.phone': farmerPhone
      }).lean();

      if (!mapping) {
        logger.warn(`No mapping found for agent ${agentPhone} and farmer ${farmerPhone}`);
        return;
      }

      const farmer = mapping.farmers.find(f => f.phone === farmerPhone);
      
      await AgentCallLog.create({
        agentPhone,
        agentName: mapping.agentName,
        farmerPhone,
        farmerName: farmer?.name || 'Unknown',
        callDate: new Date(),
        callSessionId: sessionId,
        callStatus: 'answered'
      });

      logger.info(`📞 Logged call: ${farmerPhone} → ${agentPhone}`);
    } catch (error) {
      logger.error('Failed to log agent call:', error);
    }
  }

  /**
   * Update call status when call ends
   */
  async updateCallStatus(
    sessionId: string,
    status: 'completed' | 'missed' | 'failed',
    duration?: number
  ): Promise<void> {
    try {
      await AgentCallLog.findOneAndUpdate(
        { callSessionId: sessionId },
        { callStatus: status, callDuration: duration }
      );
    } catch (error) {
      logger.error('Failed to update call status:', error);
    }
  }

  /**
   * Get call logs for an agent
   */
  async getAgentCallLogs(
    agentPhone: string,
    options: {
      limit?: number;
      page?: number;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {}
  ): Promise<{ logs: any[]; total: number; page: number; totalPages: number }> {
    try {
      const { limit = 50, page = 1, startDate, endDate, status } = options;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { agentPhone };
      
      if (startDate || endDate) {
        query.callDate = {};
        if (startDate) query.callDate.$gte = startDate;
        if (endDate) query.callDate.$lte = endDate;
      }
      
      if (status) {
        query.callStatus = status;
      }

      const [logs, total] = await Promise.all([
        AgentCallLog.find(query)
          .sort({ callDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AgentCallLog.countDocuments(query)
      ]);

      return {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Failed to get agent call logs:', error);
      return { logs: [], total: 0, page: 1, totalPages: 0 };
    }
  }
}

export default new AgentCallLogService();
