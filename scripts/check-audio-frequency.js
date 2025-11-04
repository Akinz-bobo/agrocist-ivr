const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Check audio frequency/sample rate of Cloudinary audio files
 */
class AudioFrequencyChecker {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'audio-check');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Download audio file from URL
   */
  async downloadAudio(url, filename) {
    const tempFile = path.join(this.tempDir, filename);
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempFile);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(tempFile));
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download ${url}: ${error.message}`);
    }
  }

  /**
   * Get audio properties using ffprobe
   */
  async getAudioProperties(filePath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ]);

      let output = '';
      let error = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        error += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(output);
            const audioStream = data.streams.find(s => s.codec_type === 'audio');
            
            if (audioStream) {
              resolve({
                sampleRate: parseInt(audioStream.sample_rate),
                channels: audioStream.channels,
                codec: audioStream.codec_name,
                bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null,
                duration: parseFloat(audioStream.duration || data.format.duration),
                size: parseInt(data.format.size)
              });
            } else {
              reject(new Error('No audio stream found'));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse ffprobe output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`ffprobe failed: ${error}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`ffprobe error: ${err.message}`));
      });
    });
  }

  /**
   * Check single audio URL
   */
  async checkAudioUrl(url, label = '') {
    console.log(`\n🔍 Checking: ${label || url}`);
    
    try {
      const filename = `temp_${Date.now()}.mp3`;
      const filePath = await this.downloadAudio(url, filename);
      
      const properties = await this.getAudioProperties(filePath);
      
      // Clean up temp file
      fs.unlinkSync(filePath);
      
      const is8kHz = properties.sampleRate === 8000;
      const status = is8kHz ? '✅' : '❌';
      
      console.log(`${status} Sample Rate: ${properties.sampleRate} Hz ${is8kHz ? '(8kHz ✓)' : '(NOT 8kHz!)'}`);
      console.log(`   Channels: ${properties.channels}`);
      console.log(`   Codec: ${properties.codec}`);
      console.log(`   Bitrate: ${properties.bitrate ? `${Math.round(properties.bitrate/1000)}k` : 'N/A'}`);
      console.log(`   Duration: ${properties.duration.toFixed(2)}s`);
      console.log(`   Size: ${Math.round(properties.size/1024)}KB`);
      
      return {
        url,
        label,
        is8kHz,
        properties
      };
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      return {
        url,
        label,
        is8kHz: false,
        error: error.message
      };
    }
  }

  /**
   * Check multiple audio URLs
   */
  async checkMultipleUrls(urls) {
    console.log(`🎵 Checking ${urls.length} audio files for 8kHz compliance...\n`);
    
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const urlData = urls[i];
      const url = typeof urlData === 'string' ? urlData : urlData.url;
      const label = typeof urlData === 'string' ? `File ${i+1}` : urlData.label;
      
      const result = await this.checkAudioUrl(url, label);
      results.push(result);
      
      // Small delay between checks
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    const total = results.length;
    const compliant = results.filter(r => r.is8kHz).length;
    const failed = results.filter(r => r.error).length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total files: ${total}`);
    console.log(`   8kHz compliant: ${compliant} ✅`);
    console.log(`   Non-compliant: ${total - compliant - failed} ❌`);
    console.log(`   Errors: ${failed} 🚫`);
    
    if (compliant === total - failed) {
      console.log(`\n🎉 All working files are 8kHz compliant!`);
    } else {
      console.log(`\n⚠️  Some files are not 8kHz - check Cloudinary upload process`);
    }
    
    return results;
  }

  /**
   * Cleanup temp directory
   */
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up temp directory: ${error.message}`);
    }
  }
}

// Example usage
async function main() {
  const checker = new AudioFrequencyChecker();
  
  try {
    // Check if URLs are provided via command line
    const args = process.argv.slice(2);
    if (args.length > 0) {
      console.log('🔗 Checking URLs from command line arguments...');
      const urlsFromArgs = args.map((url, index) => ({
        url,
        label: `Audio File ${index + 1}`
      }));
      await checker.checkMultipleUrls(urlsFromArgs);
    } else {
      console.log('📝 Usage:');
      console.log('');
      console.log('Single URL:');
      console.log('node scripts/check-audio-frequency.js "https://your-cloudinary-url.mp3"');
      console.log('');
      console.log('Multiple URLs:');
      console.log('node scripts/check-audio-frequency.js "url1.mp3" "url2.mp3" "url3.mp3"');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    checker.cleanup();
  }
}

// Check if ffprobe is available
function checkFFprobe() {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', ['-version']);
    ffprobe.on('close', (code) => resolve(code === 0));
    ffprobe.on('error', () => resolve(false));
  });
}

// Run the script
(async () => {
  console.log('🎵 Audio Frequency Checker for Cloudinary Files\n');
  
  const hasFFprobe = await checkFFprobe();
  if (!hasFFprobe) {
    console.error('❌ ffprobe not found. Please install ffmpeg:');
    console.error('   macOS: brew install ffmpeg');
    console.error('   Ubuntu: sudo apt install ffmpeg');
    process.exit(1);
  }
  
  await main();
})();