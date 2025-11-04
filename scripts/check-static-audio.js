const axios = require('axios');
const { spawn } = require('child_process');

/**
 * Quick audio frequency checker for single URLs
 */
async function checkAudioFrequency(url) {
  console.log(`🔍 Checking: ${url}`);
  
  try {
    // Use ffprobe directly on the URL (no download needed)
    const result = await new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'a:0',
        url
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
            const stream = data.streams[0];
            
            if (stream) {
              resolve({
                sampleRate: parseInt(stream.sample_rate),
                channels: stream.channels,
                codec: stream.codec_name,
                bitrate: stream.bit_rate ? parseInt(stream.bit_rate) : null
              });
            } else {
              reject(new Error('No audio stream found'));
            }
          } catch (parseError) {
            reject(new Error(`Parse error: ${parseError.message}`));
          }
        } else {
          reject(new Error(`ffprobe failed: ${error}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`ffprobe error: ${err.message}`));
      });
    });

    const is8kHz = result.sampleRate === 8000;
    const status = is8kHz ? '✅' : '❌';
    
    console.log(`${status} Sample Rate: ${result.sampleRate} Hz`);
    console.log(`   Channels: ${result.channels}`);
    console.log(`   Codec: ${result.codec}`);
    console.log(`   Bitrate: ${result.bitrate ? `${Math.round(result.bitrate/1000)}k` : 'N/A'}`);
    
    return is8kHz;
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Get static audio URLs from your running service
async function getStaticAudioUrls() {
  try {
    const response = await axios.get('http://localhost:3000/health');
    console.log('📡 Service is running, checking static audio cache...\n');
    
    // You can add an endpoint to expose static audio URLs
    // For now, return empty array
    return [];
  } catch (error) {
    console.log('⚠️  Service not running. Please provide URLs manually.\n');
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/check-static-audio.js <cloudinary-url>');
    console.log('');
    console.log('Example:');
    console.log('node scripts/check-static-audio.js "https://res.cloudinary.com/your-cloud/video/upload/agrocist-ivr/audio/static/en_welcome.mp3"');
    return;
  }

  console.log('🎵 Checking audio frequency...\n');
  
  for (const url of args) {
    await checkAudioFrequency(url);
    console.log('');
  }
}

main().catch(console.error);