require('dotenv').config();

// Test local audio functionality
async function testLocalAudio() {
  console.log('🧪 Testing local audio storage...\n');
  
  // Check environment variables
  const useLocal = process.env.USE_LOCAL_AUDIO === 'true';
  const localPath = process.env.LOCAL_AUDIO_PATH || './public/audio';
  
  console.log(`USE_LOCAL_AUDIO: ${useLocal}`);
  console.log(`LOCAL_AUDIO_PATH: ${localPath}`);
  console.log(`USE_CLOUDINARY: ${process.env.USE_CLOUDINARY}`);
  
  if (useLocal) {
    console.log('\n✅ Local audio storage is ENABLED');
    console.log('   - Static audio will be saved to: ./public/audio/static/');
    console.log('   - Dynamic audio will be saved to: ./public/audio/dynamic/');
    console.log('   - Cloudinary uploads will be SKIPPED');
  } else {
    console.log('\n❌ Local audio storage is DISABLED');
    console.log('   - Audio will be uploaded to Cloudinary (if enabled)');
  }
  
  // Check if directories exist
  const fs = require('fs');
  const path = require('path');
  
  const staticDir = path.join(localPath, 'static');
  const dynamicDir = path.join(localPath, 'dynamic');
  
  console.log('\n📁 Directory status:');
  console.log(`   Static: ${fs.existsSync(staticDir) ? '✅ exists' : '❌ missing'}`);
  console.log(`   Dynamic: ${fs.existsSync(dynamicDir) ? '✅ exists' : '❌ missing'}`);
  
  console.log('\n💡 To enable local storage:');
  console.log('   1. Set USE_LOCAL_AUDIO=true in .env');
  console.log('   2. Restart the server');
  console.log('   3. Audio files will be saved locally instead of Cloudinary');
}

testLocalAudio().catch(console.error);