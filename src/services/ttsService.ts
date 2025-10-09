import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { execSync } from 'child_process';
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
  language: 'en' | 'yo' | 'ha' | 'ig';
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
  private ffmpegAvailable: boolean = false;

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
    },
    ig: {
      provider: 'dsn',
      voiceId: 'amara', // Clear, loud Igbo female voice
      language: 'ig',
      gender: 'female'
    }
  };

  constructor() {
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    this.dsnBaseUrl = config.dsn.baseUrl;
    this.dsnUsername = config.dsn.username;
    this.dsnPassword = config.dsn.password;
    this.ensureAudioDirectory();
    this.checkFfmpeg();
    // Don't clear cache on startup - preserve existing audio files for faster responses
    logger.info(`TTS Service initialized with DSN API: ${this.dsnBaseUrl}`);
  }

  /**
   * Check if ffmpeg is available for audio compression
   */
  private checkFfmpeg(): void {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      this.ffmpegAvailable = true;
      logger.info('ffmpeg detected - audio compression enabled');
    } catch (error) {
      this.ffmpegAvailable = false;
      logger.warn('ffmpeg not available - audio compression disabled');
    }
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
   * Uses persistent file-based caching to avoid regenerating audio
   */
  async generateSpeech(text: string, options: TTSOptions): Promise<string> {
    const cacheKey = this.generateCacheKey(text, options);

    // Check in-memory cache first (fastest)
    if (this.audioCache.has(cacheKey)) {
      logger.debug(`Using in-memory cached audio for: ${text.substring(0, 50)}...`);
      return this.audioCache.get(cacheKey)!;
    }

    // Check file-based cache (persistent across restarts)
    // Look for compressed file first, then fallback to WAV
    const compressedFilename = `${cacheKey}_compressed.mp3`;
    const compressedFilepath = path.join(this.audioDir, compressedFilename);
    const wavFilename = `${cacheKey}.wav`;
    const wavFilepath = path.join(this.audioDir, wavFilename);

    if (fs.existsSync(compressedFilepath)) {
      const publicUrl = `${config.webhook.baseUrl}/audio/${compressedFilename}`;
      logger.debug(`Using cached compressed audio file for: ${text.substring(0, 50)}...`);
      this.audioCache.set(cacheKey, publicUrl);
      return publicUrl;
    }

    if (fs.existsSync(wavFilepath)) {
      const publicUrl = `${config.webhook.baseUrl}/audio/${wavFilename}`;
      logger.debug(`Using cached WAV audio file for: ${text.substring(0, 50)}...`);
      this.audioCache.set(cacheKey, publicUrl);
      return publicUrl;
    }

    try {
      const voiceConfig = this.voiceConfigs[options.language];
      if (!voiceConfig) {
        throw new Error(`No voice configuration found for language: ${options.language}`);
      }

      const audioUrl = await this.generateDSNSpeech(text, voiceConfig, options);

      // Cache the result in memory
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

      // Create form data for the request with audio optimization
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', voiceConfig.language);
      formData.append('voice', voiceConfig.voiceId);
      
      // Add audio optimization settings (if supported by DSN API)
      formData.append('format', 'mp3');
      // Note: DSN API may not support all these parameters, but we'll try them
      formData.append('quality', 'medium'); // Try different quality setting
      formData.append('encoding', 'mp3_64'); // Try lower bitrate encoding

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

      // Save and compress the audio file
      const buffer = Buffer.from(response.data);
      const filename = `${this.generateCacheKey(text, options)}.wav`;
      const filepath = path.join(this.audioDir, filename);

      // Save to file system and return public URL
      try {
        fs.writeFileSync(filepath, buffer);
        const originalSize = buffer.length;
        logger.info(`Saved DSN TTS audio: ${filename} (${originalSize} bytes)`);

        // Compress audio if ffmpeg is available
        let finalFilepath = filepath;
        let finalSize = originalSize;

        if (this.ffmpegAvailable) {
          try {
            const compressedFilepath = await this.compressAudio(filepath);
            if (compressedFilepath) {
              finalFilepath = compressedFilepath;
              finalSize = fs.statSync(compressedFilepath).size;
              const reduction = ((1 - finalSize / originalSize) * 100).toFixed(1);
              logger.info(`Compressed ${filename}: ${originalSize} → ${finalSize} bytes (${reduction}% reduction)`);
            }
          } catch (compressError) {
            logger.warn(`Audio compression failed for ${filename}, using original:`, compressError);
          }
        }

        // Monitor file sizes for playback optimization
        if (finalSize > 50000) {
          logger.warn(`Audio file ${path.basename(finalFilepath)} is large (${finalSize} bytes), may cause playback issues`);
        } else {
          logger.info(`Audio file ${path.basename(finalFilepath)} is optimal size (${finalSize} bytes)`);
        }

        // Return HTTPS URL to the saved audio file
        const publicUrl = `${config.webhook.baseUrl}/audio/${path.basename(finalFilepath)}`;
        logger.info(`Generated HTTPS URL for TTS audio: ${publicUrl} (${finalSize} bytes)`);
        return publicUrl;
      } catch (fsError) {
        logger.warn('Could not save audio file to disk, falling back to data URL');
        // Fallback to data URL if file cannot be saved
        const base64 = buffer.toString('base64');
        const dataUrl = `data:audio/mp3;base64,${base64}`;
        logger.info(`Generated fallback data URL for TTS audio (${buffer.length} bytes)`);
        return dataUrl;
      }
    } catch (error: any) {
      logger.error('DSN TTS API error:', error);
      throw new Error(`DSN TTS failed: ${error.response?.data || error.message}`);
    }
  }

  /**
   * Compress audio file using ffmpeg to reduce file size
   * Converts to MP3 with optimized settings for voice
   */
  private async compressAudio(inputPath: string): Promise<string | null> {
    try {
      const outputPath = inputPath.replace('.wav', '_compressed.mp3');

      // Use ffmpeg to compress:
      // -i: input file
      // -codec:a libmp3lame: use MP3 codec
      // -b:a 32k: 32kbps bitrate (good for voice, very small file)
      // -ar 16000: 16kHz sample rate (sufficient for voice)
      // -ac 1: mono audio (smaller than stereo)
      // -y: overwrite output file
      execSync(
        `ffmpeg -i "${inputPath}" -codec:a libmp3lame -b:a 32k -ar 16000 -ac 1 -y "${outputPath}"`,
        { stdio: 'ignore' }
      );

      // Delete original uncompressed file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(inputPath);
        return outputPath;
      }

      return null;
    } catch (error) {
      logger.error('Error compressing audio:', error);
      return null;
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
    const content = `v3-${text}-${options.language}-${options.speed || 1}-${options.pitch || 1}-${config.dsn.audio.bitrate}-${config.dsn.audio.sampleRate}-${config.dsn.audio.speed}`;
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