import { Request, Response } from "express";
import logger from "../utils/logger";
import { getAgentForCaller } from "../config/callerAgentMapping";

class AgentController {
  /**
   * Handle agent calling in to pick calls from their queue
   */
  handleAgentDequeue = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body as any;
      const { isActive, callerNumber } = webhookData;

      logger.info(`=== AGENT DEQUEUE WEBHOOK ===`, webhookData);

      if (isActive === "1" && callerNumber) {
        // Agent is calling in - dequeue calls for this agent
        logger.info(`📞 Agent ${callerNumber} picking calls from queue`);
        
        const dequeueXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dequeue name="${callerNumber}" />
</Response>`;
        
        res.set("Content-Type", "application/xml");
        res.send(dequeueXML);
        return;
      }

      // Call ended
      res.status(200).send("");
    } catch (error) {
      logger.error("Error handling agent dequeue:", error);
      res.status(200).send("");
    }
  };
}

export default new AgentController();
