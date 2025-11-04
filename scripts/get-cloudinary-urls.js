require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Get all audio URLs from Cloudinary
 */
async function getCloudinaryAudioUrls() {
  try {
    console.log('🔍 Fetching audio files from Cloudinary...\n');
    
    const folder = process.env.CLOUDINARY_FOLDER || 'agrocist-ivr/audio';
    
    // Search for audio files in the folder
    const result = await cloudinary.search
      .expression(`folder:${folder}/* AND resource_type:video`)
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();

    if (result.resources.length === 0) {
      console.log('❌ No audio files found in Cloudinary folder:', folder);
      return [];
    }

    console.log(`📁 Found ${result.resources.length} audio files:\n`);
    
    const urls = result.resources.map((resource, index) => {
      const url = resource.secure_url;
      const publicId = resource.public_id;
      const size = Math.round(resource.bytes / 1024);
      const created = new Date(resource.created_at).toLocaleString();
      
      console.log(`${index + 1}. ${publicId}`);
      console.log(`   URL: ${url}`);
      console.log(`   Size: ${size}KB`);
      console.log(`   Created: ${created}\n`);
      
      return url;
    });

    // Generate check command
    console.log('🚀 To check all frequencies, run:');
    console.log(`node scripts/check-static-audio.js ${urls.map(url => `"${url}"`).join(' ')}`);
    console.log('');
    
    return urls;
    
  } catch (error) {
    console.error('❌ Error fetching from Cloudinary:', error);
    
    if (error.message && error.message.includes('Invalid API key')) {
      console.log('💡 Make sure your .env file has:');
      console.log('   CLOUDINARY_CLOUD_NAME=your_cloud_name');
      console.log('   CLOUDINARY_API_KEY=your_api_key');
      console.log('   CLOUDINARY_API_SECRET=your_api_secret');
    }
    
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/get-cloudinary-urls.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --check    Also check frequency of all found files');
    console.log('  --help     Show this help message');
    return;
  }
  
  const urls = await getCloudinaryAudioUrls();
  
  if (args.includes('--check') && urls.length > 0) {
    console.log('🎵 Now checking frequencies...\n');
    
    // Import and use the frequency checker
    const { spawn } = require('child_process');
    
    for (const url of urls) {
      await checkAudioFrequency(url);
    }
  }
}

async function checkAudioFrequency(url) {
  console.log(`🔍 Checking: ${url.split('/').pop()}`);
  
  try {
    const result = await new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'a:0',
        url
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => output += data.toString());
      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(output);
            const stream = data.streams[0];
            resolve({
              sampleRate: parseInt(stream.sample_rate),
              channels: stream.channels,
              codec: stream.codec_name
            });
          } catch (e) {
            reject(new Error('Parse error'));
          }
        } else {
          reject(new Error('ffprobe failed'));
        }
      });
      ffprobe.on('error', reject);
    });

    const is8kHz = result.sampleRate === 8000;
    const status = is8kHz ? '✅' : '❌';
    
    console.log(`${status} ${result.sampleRate} Hz, ${result.channels}ch, ${result.codec}\n`);
    
  } catch (error) {
    console.log(`❌ Error checking frequency\n`);
  }
}

main().catch(console.error);