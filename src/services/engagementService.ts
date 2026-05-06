import EngagementMetrics from "../models/EngagementMetrics";
import logger from "../utils/logger";

/**
 * Handles persisting call engagement data to MongoDB.
 *
 * The system buffers all engagement data in memory during a call (via SessionManager)
 * and writes it in a single operation when the call ends. This avoids per-event
 * database writes and keeps the call flow fast.
 */
class EngagementService {
  /**
   * Write all buffered engagement data for a completed call to MongoDB.
   * Called once per call, in the background, after the call ends.
   */
  async flushEngagementToDatabase(
    sessionId: string,
    engagementBuffer: any,
    phoneNumber: string,
    startTime: Date
  ): Promise<void> {
    try {
      const endTime = new Date();
      const totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      const interactions = engagementBuffer.aiInteractionsDetailed ?? [];
      const totalRecordingTime = interactions.reduce(
        (sum: number, i: any) => sum + (i.userRecordingDuration ?? 0),
        0
      );

      const data = {
        sessionId,
        phoneNumber,
        callStartTime: startTime,
        callEndTime: endTime,
        totalDuration,
        selectedLanguage: engagementBuffer.selectedLanguage,
        languageSelectionTime: engagementBuffer.languageSelectionTime,
        currentState: engagementBuffer.currentState ?? "CALL_ENDED",
        finalState: engagementBuffer.currentState ?? "CALL_ENDED",
        stateTransitions: engagementBuffer.stateTransitions ?? [],
        aiInteractions: interactions,
        totalAIInteractions: interactions.length,
        totalRecordingTime,
        averageRecordingLength: interactions.length > 0 ? totalRecordingTime / interactions.length : 0,
        dtmfInputs: engagementBuffer.dtmfInputs ?? [],
        wasTransferredToAgent: engagementBuffer.wasTransferredToAgent ?? false,
        transferRequestTime: engagementBuffer.transferRequestTime,
        completedSuccessfully: engagementBuffer.completedSuccessfully ?? false,
        terminationReason: engagementBuffer.terminationReason ?? "USER_HANGUP",
        terminationTime: endTime,
        errorRecords: engagementBuffer.errorRecords ?? [],
        userAgent: engagementBuffer.userAgent,
        ipAddress: engagementBuffer.ipAddress,
        callId: engagementBuffer.callId,
        serverVersion: "0.1.0",
      };

      // Upsert so a duplicate flush (e.g. from a retry) doesn't create duplicate records
      await EngagementMetrics.findOneAndUpdate({ sessionId }, { $set: data }, { upsert: true });

      logger.info(`💾 Engagement flushed: ${sessionId} | ${phoneNumber} | ${totalDuration}s | ${interactions.length} interactions`);

      // Log each interaction for debugging
      interactions.forEach((interaction: any, index: number) => {
        const query = interaction.userQuery?.query ?? interaction.userQuery ?? "";
        const hasRecording = interaction.userQuery?.url ? "✅" : "—";
        const hasAudio = interaction.aiResponse?.url ? "✅" : "—";
        logger.info(`  [${index + 1}] User: "${query}" (recording: ${hasRecording}) | AI audio: ${hasAudio}`);
      });
    } catch (error) {
      logger.error(`Failed to flush engagement data for ${sessionId}:`, error);
    }
  }
}

export default new EngagementService();
