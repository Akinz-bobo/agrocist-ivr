import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
}

class CloudinaryService {
  private isConfigured: boolean = false;
  private fileExistenceCache: Map<string, { exists: boolean; timestamp: number }> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeCloudinary();
  }

  /**
   * Initialize Cloudinary configuration
   */
  private initializeCloudinary(): void {
    if (!config.cloudinary.useCloudinary) {
      logger.info('Cloudinary disabled via USE_CLOUDINARY environment variable');
      return;
    }

    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
      logger.warn('Cloudinary credentials missing - using local file storage');
      return;
    }

    try {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true
      });

      this.isConfigured = true;
      logger.info(`Cloudinary configured successfully for cloud: ${config.cloudinary.cloudName}`);
    } catch (error) {
      logger.error('Failed to configure Cloudinary:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if Cloudinary is enabled and configured
   */
  isEnabled(): boolean {
    return config.cloudinary.useCloudinary && this.isConfigured;
  }

  /**
   * Upload audio file to Cloudinary
   */
  async uploadAudio(
    filePath: string, 
    options: {
      publicId?: string;
      folder?: string;
      resourceType?: 'auto' | 'image' | 'video' | 'raw';
      overwrite?: boolean;
    } = {}
  ): Promise<CloudinaryUploadResult | null> {
    if (!this.isEnabled()) {
      logger.debug('Cloudinary not enabled, skipping upload');
      return null;
    }

    if (!fs.existsSync(filePath)) {
      logger.error(`File not found for Cloudinary upload: ${filePath}`);
      return null;
    }

    try {
      const uploadOptions: any = {
        resource_type: options.resourceType || 'auto' as const,
        folder: options.folder || config.cloudinary.folder,
        overwrite: options.overwrite !== false,
        use_filename: true,
        unique_filename: !options.publicId, // Only use unique filename if no publicId provided
        format: 'mp3', // Ensure consistent format
        quality: 'auto:good', // Optimize for good quality with smaller size
      };

      // Only add public_id if it's defined
      if (options.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      logger.debug(`Uploading to Cloudinary: ${filePath}`);
      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      const uploadResult: CloudinaryUploadResult = {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type
      };

      // Update cache to mark this file as existing
      this.fileExistenceCache.set(result.public_id, { exists: true, timestamp: Date.now() });

      const fileSize = fs.statSync(filePath).size;
      logger.info(`✅ Cloudinary upload successful: ${result.secure_url} (${fileSize} bytes)`);

      return uploadResult;
    } catch (error: any) {
      logger.error('Cloudinary upload failed:', error);
      return null;
    }
  }

  /**
   * Upload audio buffer directly to Cloudinary (without saving to disk first)
   */
  async uploadAudioBuffer(
    buffer: Buffer,
    options: {
      publicId?: string;
      folder?: string;
      filename?: string;
    } = {}
  ): Promise<CloudinaryUploadResult | null> {
    if (!this.isEnabled()) {
      logger.debug('Cloudinary not enabled, skipping buffer upload');
      return null;
    }

    try {
      const uploadOptions: any = {
        resource_type: 'auto' as const,
        folder: options.folder || config.cloudinary.folder,
        overwrite: true,
        use_filename: true,
        unique_filename: !options.publicId,
        format: 'mp3',
        quality: 'auto:good',
      };

      // Only add public_id if it's defined
      if (options.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      logger.debug(`Uploading buffer to Cloudinary (${buffer.length} bytes)`);

      // Convert buffer to base64 data URL for upload with 15s timeout
      const base64Data = `data:audio/mp3;base64,${buffer.toString('base64')}`;

      // Add timeout to prevent hanging uploads
      const uploadPromise = cloudinary.uploader.upload(base64Data, { ...uploadOptions, timeout: 15000 });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cloudinary upload timeout (15s)')), 15000)
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]) as any;

      const uploadResult: CloudinaryUploadResult = {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type
      };

      // Update cache to mark this file as existing
      this.fileExistenceCache.set(result.public_id, { exists: true, timestamp: Date.now() });

      logger.info(`✅ Cloudinary buffer upload successful: ${result.secure_url} (${buffer.length} bytes)`);

      return uploadResult;
    } catch (error: any) {
      logger.error('Cloudinary buffer upload failed:', error);
      return null;
    }
  }

  /**
   * Delete audio file from Cloudinary
   */
  async deleteAudio(publicId: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'auto'
      });

      if (result.result === 'ok') {
        // Remove from cache when deleted
        this.fileExistenceCache.delete(publicId);
        logger.info(`✅ Cloudinary deletion successful: ${publicId}`);
        return true;
      } else {
        logger.warn(`Cloudinary deletion failed: ${publicId} - ${result.result}`);
        return false;
      }
    } catch (error: any) {
      logger.error('Cloudinary deletion failed:', error);
      return false;
    }
  }

  /**
   * Check if a file exists on Cloudinary with caching to reduce API calls
   */
  async fileExists(publicId: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Check cache first
    const cached = this.fileExistenceCache.get(publicId);
    const now = Date.now();
    
    // Use cached result if not expired
    if (cached && (now - cached.timestamp) < this.cacheExpiryMs) {
      logger.debug(`Using cached existence result for ${publicId}: ${cached.exists}`);
      return cached.exists;
    }
    
    // If no cache entry or cache expired, check Cloudinary API

    try {
      // Audio/MP3 files are stored as 'video' resource type in Cloudinary
      await cloudinary.api.resource(publicId, { resource_type: 'video' });
      
      // Cache the positive result
      this.fileExistenceCache.set(publicId, { exists: true, timestamp: now });
      logger.debug(`File exists on Cloudinary (cached): ${publicId}`);
      return true;
    } catch (error: any) {
      if (error.http_code === 404) {
        // Cache the negative result for a shorter time (1 minute) in case file gets uploaded
        this.fileExistenceCache.set(publicId, { exists: false, timestamp: now });
        return false; // File doesn't exist - this is expected
      }
      
      // Handle rate limiting specifically
      if (error.error?.http_code === 420 || error.http_code === 420) {
        const retryTime = error.error?.message?.match(/Try again on ([\d-:\s]+) UTC/)?.[1];
        logger.warn(`🚨 Cloudinary rate limit exceeded (500 operations). Files will be regenerated. Retry after: ${retryTime || 'unknown time'}`);
        // Don't cache rate limit errors - we want to retry later
        return false; // Treat as file not found to trigger regeneration
      }
      
      // Log other unexpected errors
      logger.warn(`Error checking Cloudinary file existence for ${publicId}:`, error.error?.message || error.message || 'Unknown error');
      // Don't cache errors - we want to retry
      return false;
    }
  }

  /**
   * Get optimized Cloudinary URL with transformations
   */
  getOptimizedUrl(
    publicId: string, 
    options: {
      format?: string;
      quality?: string;
      bitRate?: string;
    } = {}
  ): string | null {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const transformations = [];
      
      if (options.format) {
        transformations.push(`f_${options.format}`);
      }
      
      if (options.quality) {
        transformations.push(`q_${options.quality}`);
      }
      
      if (options.bitRate) {
        transformations.push(`br_${options.bitRate}`);
      }

      const url = cloudinary.url(publicId, {
        resource_type: 'video', // Audio files are stored as 'video' resource type in Cloudinary
        secure: true,
        transformation: transformations.length > 0 ? transformations.join(',') : undefined
      });

      return url;
    } catch (error: any) {
      logger.error('Failed to generate Cloudinary URL:', error);
      return null;
    }
  }

  /**
   * Generate a unique public ID for audio files using the same cache key logic as local files
   */
  generatePublicId(text: string, language: string, type: 'static' | 'dynamic' = 'dynamic', textKey?: string): string {
    const crypto = require('crypto');
    const config = require('../config').default;
    
    // Use the same cache key logic as TTSService for consistency
    const content = `v3-${text}-${language}-1-1-${config.dsn.audio.bitrate}-${config.dsn.audio.sampleRate}-${config.dsn.audio.speed}`;
    const hash = crypto.createHash('md5').update(content).digest('hex');
    
    // For static files, use descriptive naming: static_welcome_en, static_processing_yo, etc.
    if (type === 'static' && textKey) {
      return `static_${textKey}_${language}`;
    } else if (type === 'static') {
      // Fallback for static files without textKey
      return `static-${language}-${hash}`;
    } else {
      return `dynamic-${language}-${hash.substring(0, 8)}-${Date.now()}`;
    }
  }

  /**
   * Cleanup old audio files from Cloudinary
   */
  async cleanupOldAudio(maxAgeHours: number = 24): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      // Simplified cleanup - just log that cleanup was requested
      // The advanced search functionality can be implemented later when needed
      logger.info(`🧹 Cloudinary cleanup requested for files older than ${maxAgeHours} hours`);
      logger.info('Note: Advanced cleanup features require additional Cloudinary configuration');
    } catch (error: any) {
      logger.error('Cloudinary cleanup failed:', error);
    }
  }

  /**
   * Get Cloudinary usage statistics
   */
  async getUsageStats(): Promise<any> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const usage = await cloudinary.api.usage();
      return usage;
    } catch (error: any) {
      logger.error('Failed to get Cloudinary usage stats:', error);
      return null;
    }
  }

  /**
   * Clear the file existence cache
   */
  clearFileExistenceCache(): void {
    this.fileExistenceCache.clear();
    logger.info('Cloudinary file existence cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ publicId: string; exists: boolean; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.fileExistenceCache.entries()).map(([publicId, data]) => ({
      publicId,
      exists: data.exists,
      age: Math.round((now - data.timestamp) / 1000) // age in seconds
    }));

    return {
      size: this.fileExistenceCache.size,
      entries
    };
  }

  /**
   * Pre-populate cache with known static files to reduce API calls
   */
  prePopulateCache(staticFiles: Array<{ publicId: string; exists: boolean }>): void {
    const now = Date.now();
    staticFiles.forEach(file => {
      this.fileExistenceCache.set(file.publicId, {
        exists: file.exists,
        timestamp: now
      });
    });
    logger.info(`Pre-populated cache with ${staticFiles.length} static file entries`);
  }
}

export default new CloudinaryService();