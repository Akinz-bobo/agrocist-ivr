import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

class LocalAudioService {
  private basePath: string;

  constructor() {
    this.basePath = config.audio.localPath;
    this.ensureDirectories();
  }

  /**
   * Ensure audio directories exist
   */
  private ensureDirectories(): void {
    const staticDir = path.join(this.basePath, 'static');
    const dynamicDir = path.join(this.basePath, 'dynamic');
    
    [this.basePath, staticDir, dynamicDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created audio directory: ${dir}`);
      }
    });
  }

  /**
   * Save audio buffer to local file
   */
  async saveAudioBuffer(
    buffer: Buffer,
    options: {
      type: 'static' | 'dynamic';
      filename?: string;
      language?: string;
      textKey?: string;
    }
  ): Promise<string | null> {
    try {
      const { type, filename, language, textKey } = options;
      
      // Generate filename if not provided
      let audioFilename: string;
      if (filename) {
        audioFilename = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
      } else if (language && textKey) {
        audioFilename = `${language}_${textKey}.mp3`;
      } else {
        const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
        audioFilename = `audio_${Date.now()}_${hash}.mp3`;
      }

      const filePath = path.join(this.basePath, type, audioFilename);
      
      // Write buffer to file
      fs.writeFileSync(filePath, buffer);
      
      // Return relative URL for serving
      const relativeUrl = `/audio/${type}/${audioFilename}`;
      
      logger.info(`Saved ${type} audio: ${relativeUrl} (${buffer.length} bytes)`);
      return relativeUrl;
      
    } catch (error) {
      logger.error('Failed to save audio locally:', error);
      return null;
    }
  }

  /**
   * Check if local audio storage is enabled
   */
  isEnabled(): boolean {
    return config.audio.useLocal;
  }

  /**
   * Get file path from URL
   */
  getFilePath(url: string): string {
    return path.join(this.basePath, url.replace('/audio/', ''));
  }

  /**
   * Check if file exists
   */
  fileExists(url: string): boolean {
    const filePath = this.getFilePath(url);
    return fs.existsSync(filePath);
  }
}

export default new LocalAudioService();