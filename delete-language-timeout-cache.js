// Quick script to delete old languageTimeout audio files from Cloudinary
// Run this once to clear the cache, then restart the server to regenerate with new text

const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const folder = process.env.CLOUDINARY_FOLDER || 'agrocist-ivr/audio';
const languages = ['en', 'yo', 'ha', 'ig'];

async function deleteLanguageTimeoutFiles() {
  console.log('🗑️  Deleting old languageTimeout audio files from Cloudinary...\n');

  for (const lang of languages) {
    const publicId = `${folder}/static/static_languageTimeout_${lang}`;
    console.log(`Deleting: ${publicId}`);

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'video' // Cloudinary treats audio as video
      });

      if (result.result === 'ok') {
        console.log(`✅ Deleted: ${publicId}`);
      } else if (result.result === 'not found') {
        console.log(`⚠️  Not found (already deleted): ${publicId}`);
      } else {
        console.log(`❌ Failed: ${publicId} - ${result.result}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting ${publicId}:`, error.message);
    }
  }

  console.log('\n✅ Done! Now restart the server to regenerate the audio files with updated text.');
}

deleteLanguageTimeoutFiles();
