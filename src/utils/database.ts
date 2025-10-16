import mongoose from 'mongoose';
import config from '../config';
import logger from './logger';

class DatabaseConnection {
  private isConnected: boolean = false;

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Database already connected');
      return;
    }

    try {
      // Set mongoose options with better stability settings
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 30000, // Increased from 5s to 30s
        socketTimeoutMS: 60000, // Increased from 45s to 60s
        connectTimeoutMS: 30000, // Added connection timeout
        heartbeatFrequencyMS: 10000, // Check connection every 10s
        family: 4, // Use IPv4, skip trying IPv6
        retryWrites: true,
        retryReads: true,
        w: 'majority' as const,
        maxIdleTimeMS: 60000, // Close idle connections after 60s
        compressors: ['zlib' as const] // Enable compression
      };

      // Connect to MongoDB
      await mongoose.connect(config.database.mongoUri, options);

      this.isConnected = true;
      logger.info(`📊 Connected to MongoDB: ${this.maskUri(config.database.mongoUri)}`);

      // Only set up event handlers once
      if (mongoose.connection.listenerCount('error') === 0) {
        mongoose.connection.on('error', (error) => {
          logger.error('MongoDB connection error:', error);
          this.isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB disconnected - will auto-reconnect');
          this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
          logger.info('MongoDB reconnected successfully');
          this.isConnected = true;
        });

        mongoose.connection.on('connected', () => {
          logger.info('MongoDB connected');
          this.isConnected = true;
        });
      }

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    readyState: number;
    host?: string;
    name?: string;
  } {
    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  /**
   * Mask sensitive parts of URI for logging
   */
  private maskUri(uri: string): string {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }

  /**
   * Test database connection with a simple operation
   */
  async testConnection(): Promise<boolean> {
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Database ping failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    try {
      if (!this.isConnected) {
        return { error: 'Not connected to database' };
      }

      const stats = await mongoose.connection.db!.stats();
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize,
        objects: stats.objects,
        storageSize: stats.storageSize
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export default new DatabaseConnection();