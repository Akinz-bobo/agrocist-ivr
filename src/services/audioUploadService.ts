import axios from 'axios';
import cloudinaryService from './cloudinaryService';
import logger from '../utils/logger';

class AudioUploadService {
  /**
   * Upload user recording to Cloudinary
   */
  async uploadUserRecording(recordingUrl: string, sessionId: string): Promise<string | null> {
    try {
      // Download the audio file from Africa's Talking
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      const audioBuffer = Buffer.from(response.data);
      logger.info(`Downloaded user recording: ${audioBuffer.length} bytes`);
      
      // Upload to Cloudinary
      const publicId = `user_recording_${sessionId}_${Date.now()}`;
      const result = await cloudinaryService.uploadAudioBuffer(audioBuffer, {
        publicId,
        folder: 'agrocist-ivr/recordings',
        type: 'dynamic'
      });
      
      if (result?.secureUrl) {
        logger.info(`✅ User recording uploaded to Cloudinary: ${result.secureUrl}`);
        return result.secureUrl;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to upload user recording to Cloudinary:`, error);
      return null;
    }
  }
}

export default new AudioUploadService();