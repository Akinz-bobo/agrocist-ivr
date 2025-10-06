import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import config from '../config';
import logger from '../utils/logger';

export interface TTSVoiceConfig {
  provider: 'dsn';
  voiceId: string;
  language: string;
  gender?: 'male' | 'female';
  model?: string;
}

export interface TTSOptions {
  language: 'en' | 'yo' | 'ha';
  speed?: number;
  pitch?: number;
  volume?: number;
}

class TTSService {
  private audioCache: Map<string, string> = new Map();
  private audioDir: string;
  private dsnBaseUrl: string;
  private dsnUsername: string;
  private dsnPassword: string;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  // Voice configurations for each language using DSN service
  private voiceConfigs: Record<string, TTSVoiceConfig> = {
    en: {
      provider: 'dsn',
      voiceId: 'lucy', // Very clear English female voice
      language: 'en',
      gender: 'female'
    },
    yo: {
      provider: 'dsn',
      voiceId: 'sade', // Energetic but breezy Yoruba female voice
      language: 'yo',
      gender: 'female'
    },
    ha: {
      provider: 'dsn',
      voiceId: 'zainab', // Clear, loud Hausa female voice
      language: 'ha',
      gender: 'female'
    }
  };

  constructor() {
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    this.dsnBaseUrl = config.dsn.baseUrl;
    this.dsnUsername = config.dsn.username;
    this.dsnPassword = config.dsn.password;
    this.ensureAudioDirectory();
    logger.info(`TTS Service initialized with DSN API: ${this.dsnBaseUrl}`);
  }

  private ensureAudioDirectory(): void {
    try {
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
        logger.info(`Created audio directory: ${this.audioDir}`);
      }
    } catch (error) {
      logger.warn('Could not create audio directory, using memory cache only:', error);
    }
  }

  /**
   * Generate speech from text using DSN TTS API
   */
  async generateSpeech(text: string, options: TTSOptions): Promise<string> {
    const cacheKey = this.generateCacheKey(text, options);
    
    // Check cache first
    if (this.audioCache.has(cacheKey)) {
      logger.debug(`Using cached audio for: ${text.substring(0, 50)}...`);
      return this.audioCache.get(cacheKey)!;
    }

    try {
      const voiceConfig = this.voiceConfigs[options.language];
      if (!voiceConfig) {
        throw new Error(`No voice configuration found for language: ${options.language}`);
      }
      
      const audioUrl = await this.generateDSNSpeech(text, voiceConfig, options);

      // Cache the result
      this.audioCache.set(cacheKey, audioUrl);
      logger.info(`Generated DSN TTS audio for ${options.language}: ${text.substring(0, 50)}...`);
      
      return audioUrl;
    } catch (error) {
      logger.error('Error generating DSN speech:', error);
      throw error;
    }
  }

  /**
   * Generate speech using DSN TTS API
   */
  private async generateDSNSpeech(text: string, voiceConfig: TTSVoiceConfig, options: TTSOptions): Promise<string> {
    try {
      // Get authentication token
      const token = await this.authenticateDSN();
      if (!token) {
        throw new Error('Failed to authenticate with DSN API');
      }

      // Create form data for the request
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', voiceConfig.language);
      formData.append('voice', voiceConfig.voiceId);

      // Make request to DSN TTS API with Bearer token
      const response = await axios({
        method: 'POST',
        url: `${this.dsnBaseUrl}/api/v1/ai/spitch/text-to-speech`,
        data: formData,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${token}`
        },
        responseType: 'arraybuffer' // Expect MP3 binary data
      });

      // Save the MP3 file
      const buffer = Buffer.from(response.data);
      const filename = `${this.generateCacheKey(text, options)}.mp3`;
      const filepath = path.join(this.audioDir, filename);
      
      // Try to save to file system
      try {
        fs.writeFileSync(filepath, buffer);
        const audioUrl = `${config.webhook.baseUrl}/audio/${filename}`;
        logger.info(`Saved DSN TTS audio: ${filename} (${buffer.length} bytes)`);
        return audioUrl;
      } catch (fsError) {
        // If file system is not available (like on Render), return a data URL
        logger.warn('Could not save audio file to disk, using data URL');
        const base64 = buffer.toString('base64');
        return `data:audio/mp3;base64,${base64}`;
      }
    } catch (error: any) {
      logger.error('DSN TTS API error:', error);
      throw new Error(`DSN TTS failed: ${error.response?.data || error.message}`);
    }
  }

  /**
   * Authenticate with DSN API and get Bearer token
   */
  private async authenticateDSN(): Promise<string | null> {
    try {
      // Check if we have a valid token that's not expired
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.authToken;
      }

      logger.info('Authenticating with DSN API...');
      
      // Use correct DSN authentication endpoint
      const authResponse = await axios({
        method: 'POST',
        url: `${this.dsnBaseUrl}/api/v1/auth/login/json`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          identifier: this.dsnUsername,
          password: this.dsnPassword
        }
      });

      if (authResponse.data && authResponse.data.access_token) {
        this.authToken = authResponse.data.access_token;
        // Set token expiry (assume 1 hour if not provided)
        this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        logger.info(`DSN authentication successful, token expires: ${this.tokenExpiry}`);
        return this.authToken;
      } else {
        logger.error('DSN authentication failed: No access_token in response', authResponse.data);
        return null;
      }

    } catch (error: any) {
      logger.error('DSN authentication error:', error.response?.data || error.message);
      // Clear stored token on auth failure
      this.authToken = null;
      this.tokenExpiry = null;
      return null;
    }
  }

  /**
   * Generate a unique cache key for text and options
   */
  private generateCacheKey(text: string, options: TTSOptions): string {
    const content = `${text}-${options.language}-${options.speed || 1}-${options.pitch || 1}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Update voice configuration for a language
   */
  updateVoiceConfig(language: string, config: TTSVoiceConfig): void {
    this.voiceConfigs[language] = config;
    logger.info(`Updated voice config for ${language}:`, config);
  }

  /**
   * Get available voices for a language
   */
  getVoiceConfig(language: string): TTSVoiceConfig | undefined {
    return this.voiceConfigs[language];
  }

  /**
   * Clear audio cache
   */
  clearCache(): void {
    this.audioCache.clear();
    logger.info('TTS cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.audioCache.size,
      keys: Array.from(this.audioCache.keys())
    };
  }

  /**
   * Cleanup old audio files (for file system storage)
   */
  async cleanupOldAudioFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.audioDir)) return;

      const files = fs.readdirSync(this.audioDir);
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.audioDir, file);
        const stats = fs.statSync(filepath);
        
        if (Date.now() - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old audio files`);
      }
    } catch (error) {
      logger.error('Error cleaning up audio files:', error);
    }
  }
}

export default new TTSService();