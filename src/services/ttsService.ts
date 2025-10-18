import axios from 'axios';
import FormData from 'form-data';
import config from '../config';
import logger from '../utils/logger';
import cloudinaryService from './cloudinaryService';

export interface TTSOptions {
  language: 'en' | 'yo' | 'ha' | 'ig';
}

class TTSService {
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Voice configurations for each language using DSN service
  private voiceConfigs = {
    en: { voiceId: 'lucy', language: 'en' },
    yo: { voiceId: 'sade', language: 'yo' },
    ha: { voiceId: 'zainab', language: 'ha' },
    ig: { voiceId: 'amara', language: 'ig' }
  };

  /**
   * Generate AI audio - simplified single function
   */
  async generateAIAudio(text: string, language: 'en' | 'yo' | 'ha' | 'ig', speed: number = 0.9): Promise<string> {
    try {
      // Get authentication token
      const token = await this.authenticateDSN();
      if (!token) {
        throw new Error('Failed to authenticate with DSN API');
      }

      const voiceConfig = this.voiceConfigs[language];
      if (!voiceConfig) {
        throw new Error(`No voice configuration found for language: ${language}`);
      }

      // Create form data for DSN API request with speed control
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', voiceConfig.language);
      formData.append('voice', voiceConfig.voiceId);
      formData.append('format', 'mp3');
      formData.append('speed', speed.toString()); // Control playback speed (0.5-2.0, default 0.9 for slower, clearer speech)

      // Make request to DSN TTS API
      const response = await axios({
        method: 'POST',
        url: `${config.dsn.baseUrl}/api/v1/ai/spitch/text-to-speech`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Get audio buffer and upload to Cloudinary
      const buffer = Buffer.from(response.data);
      logger.info(`Generated DSN TTS audio buffer: ${buffer.length} bytes`);

      // Upload to Cloudinary if enabled
      if (cloudinaryService.isEnabled()) {
        // IMPORTANT: Do NOT provide publicId for dynamic AI responses - let Cloudinary generate unique filenames
        // This prevents caching and ensures each AI response gets fresh audio (no reuse)
        const cloudinaryResult = await cloudinaryService.uploadAudioBuffer(buffer, {
          folder: config.cloudinary.folder,
          filename: `ai-response-${Date.now()}`
        });

        if (cloudinaryResult) {
          logger.info(`✅ Uploaded fresh AI audio to Cloudinary (no cache): ${cloudinaryResult.secureUrl}`);
          return cloudinaryResult.secureUrl;
        } else {
          logger.warn('Cloudinary upload failed, falling back to data URL');
        }
      }

      // Fallback to data URL if Cloudinary is disabled or upload failed
      const base64 = buffer.toString('base64');
      const dataUrl = `data:audio/mp3;base64,${base64}`;
      logger.info(`Generated data URL for AI audio (${buffer.length} bytes)`);
      return dataUrl;

    } catch (error: any) {
      // If we get a 403, token might be expired - try re-authenticating once
      if (error.response?.status === 403) {
        logger.warn(`403 Forbidden from DSN API - token may be expired, attempting re-authentication...`);

        // Clear cached token to force re-authentication
        this.authToken = null;
        this.tokenExpiry = null;

        // Try one more time with fresh token
        try {
          const newToken = await this.authenticateDSN();
          if (!newToken) {
            throw new Error('Re-authentication failed');
          }

          // Retry the TTS request with new token
          const voiceConfig = this.voiceConfigs[language];
          const formData = new FormData();
          formData.append('text', text);
          formData.append('language', voiceConfig.language);
          formData.append('voice', voiceConfig.voiceId);
          formData.append('format', 'mp3');
          formData.append('speed', speed.toString());

          const response = await axios({
            method: 'POST',
            url: `${config.dsn.baseUrl}/api/v1/ai/spitch/text-to-speech`,
            data: formData,
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${newToken}`
            },
            responseType: 'arraybuffer',
            timeout: 30000
          });

          const buffer = Buffer.from(response.data);
          logger.info(`✅ TTS successful after re-authentication: ${buffer.length} bytes`);

          // Upload to Cloudinary
          if (cloudinaryService.isEnabled()) {
            // Do NOT provide publicId - ensure fresh upload every time
            const cloudinaryResult = await cloudinaryService.uploadAudioBuffer(buffer, {
              folder: config.cloudinary.folder,
              filename: `ai-response-${Date.now()}`
            });

            if (cloudinaryResult) {
              logger.info(`✅ Uploaded fresh AI audio to Cloudinary after retry (no cache): ${cloudinaryResult.secureUrl}`);
              return cloudinaryResult.secureUrl;
            }
          }

          // Fallback to data URL
          const base64 = buffer.toString('base64');
          return `data:audio/mp3;base64,${base64}`;

        } catch (retryError: any) {
          logger.error(`Failed to generate AI audio after re-authentication:`, retryError.message || 'Unknown error');
          throw new Error(`AI audio generation failed after retry: ${retryError.message || 'Unknown error'}`);
        }
      }

      logger.error(`Failed to generate AI audio for ${language}:`, error.message || 'Unknown error');
      throw new Error(`AI audio generation failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Authenticate with DSN API and get Bearer token
   */
  async authenticateDSN(): Promise<string | null> {
    try {
      // Check if we have a valid token that's not expired
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.authToken;
      }

      logger.info('Authenticating with DSN API...');
      
      const authResponse = await axios({
        method: 'POST',
        url: `${config.dsn.baseUrl}/api/v1/auth/login/json`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          identifier: config.dsn.username,
          password: config.dsn.password
        },
        timeout: 15000
      });

      if (authResponse.data && authResponse.data.access_token) {
        this.authToken = authResponse.data.access_token;
        // Set token expiry (assume 1 hour if not provided)
        this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        
        logger.info(`DSN authentication successful, token expires: ${this.tokenExpiry}`);
        return this.authToken;
      } else {
        logger.warn('DSN authentication failed: No access_token in response');
        return null;
      }

    } catch (error: any) {
      logger.warn('DSN authentication failed:', error.message || 'Unknown error');
      
      // Clear stored token on auth failure
      this.authToken = null;
      this.tokenExpiry = null;
      return null;
    }
  }
}

export default new TTSService();