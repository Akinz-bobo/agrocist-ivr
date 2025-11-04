import { spawn } from 'child_process';
import logger from './logger';

export class AudioProcessor {
  private static ffmpegAvailable: boolean | null = null;

  /**
   * Convert audio buffer to 8kHz using ffmpeg
   */
  static async convertTo8kHz(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',           // Input from stdin
        '-ar', '8000',            // Set sample rate to 8kHz
        '-ac', '1',               // Mono channel
        '-f', 'mp3',              // Output format MP3
        '-b:a', '32k',            // Low bitrate for telephony
        'pipe:1'                  // Output to stdout
      ]);

      const chunks: Buffer[] = [];
      
      ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      ffmpeg.stderr.on('data', (data) => {
        logger.debug(`ffmpeg stderr: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          const outputBuffer = Buffer.concat(chunks);
          logger.debug(`Audio converted to 8kHz: ${inputBuffer.length} -> ${outputBuffer.length} bytes`);
          resolve(outputBuffer);
        } else {
          reject(new Error(`ffmpeg process exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`ffmpeg error: ${error.message}`));
      });

      // Write input buffer to ffmpeg stdin
      ffmpeg.stdin.write(inputBuffer);
      ffmpeg.stdin.end();
    });
  }

  /**
   * Check if ffmpeg is available (cached)
   */
  static async isFFmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) {
      return this.ffmpegAvailable;
    }
    
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('close', (code) => {
        this.ffmpegAvailable = code === 0;
        resolve(this.ffmpegAvailable);
      });
      ffmpeg.on('error', () => {
        this.ffmpegAvailable = false;
        resolve(false);
      });
    });
  }
}