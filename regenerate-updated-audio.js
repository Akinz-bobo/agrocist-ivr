#!/usr/bin/env node

/**
 * One-time script to regenerate specific updated audio files and upload to Cloudinary
 * Run with: node regenerate-updated-audio.js
 */

// Load environment variables from .env file
require('dotenv').config();

const Spitch = require('spitch').default;
const { v2: cloudinary } = require('cloudinary');
const crypto = require('crypto');

// Configuration - uses environment variables
const config = {
  spitch: {
    apiKey: process.env.SPITCH_API_KEY
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'agrocist-ivr'
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// Updated texts (only the ones that changed)
const staticTexts = {
  yo: {
    processing: "O ṣeun fún ìbéèrè yín. Agrocist ń ṣe ìtúpalẹ̀ ìbéèrè yín.",
    analysisWait: "Ẹ jọ̀ọ́, ẹ dúró díẹ̀ kí a lè ṣe ìtúpalẹ̀ ìbéèrè yín. Ó lè gba ìsẹ́jú díẹ̀.",
    error: "Ẹ má bínú, ohun tí ẹ sọ kò ye mí. Ẹ jẹ́ kí n gbe yín padà sí ipele àkọ́kọ́.",
    goodbye: "O ṣeun fún lílo Agrocist. Ẹ ní ọjọ́ àlàáfíà!",
    noRecording: "Mi ò gbọ́ ohun tí ẹ wí. Ẹ jọ̀ọ́, kí ẹ gbìyànjú lẹ́ẹ̀kansi lẹ́yìn tí ẹ bá gbọ́ agogo náà.",
    wait: "Ẹ jọ̀ọ́, ẹ dúró díẹ̀, a ń ṣe ìmúlòlùfẹ́ ìbéèrè yín.",
    directRecording: "Ẹ ti yan èdè Yorùbá. Ẹ ṣàpèjúwe ìbéèrè ẹran-ọ̀sìn yín. Ẹ sọ kedere lẹ́yìn tí ẹ gbọ́ agogo náà. Kí ẹ sì tẹ haasi nígbà tí ẹ bá parí.",
    followUpRecording: "Kí ni míì tí ẹ fẹ́ kí n ran yín lọ́wọ́?",
    postAIMenu: "Tẹ ookan fún ìbéèrè míì, tàbí tẹ oodo láti parí ìpè.",
    noInputMessage: "A kò gba yíyan kankan. Ẹ jẹ́ kí n tún àwọn àṣàyàn náà sọ.",
    transfer: "Ẹ jọ̀ọ́, ẹ dúró díẹ̀ kí n bá yín so pọ̀ mọ́ amòfin ẹranko wa.",
    languageTimeout: "Ẹ ò tẹ́ nkankan, tẹ́ ookan fún Gẹ̀ẹ́sì, eeji fún Yorùbá, eeta fún Hausa, tàbí eerin fún Ìgbò."
  },
  ha: {
    postAIMenu: "Latsa daya don wani tambaya, ko sifili don rufe kiran.",
    languageTimeout: "Ba ku danna komai ba, latsa daya don Turanci, biyu don Yoruba, uku don Hausa, ko hudu don Igbo."
  },
  ig: {
    postAIMenu: "Pịa otu maka ajụjụ ọzọ, ma ọ bụ pịa efu ka ị kwụsị oku.",
    languageTimeout: "Ị nweghị pịa ihe ọ bụla, pịa otu maka Bekee, abụọ maka Yoruba, atọ maka Hausa, ma ọ bụ anọ maka Igbo."
  }
};

// Files to regenerate
const filesToRegenerate = [
  // All Yoruba files
  ...Object.keys(staticTexts.yo).map(key => ({ language: 'yo', key })),
  // Specific Hausa files
  { language: 'ha', key: 'postAIMenu' },
  { language: 'ha', key: 'languageTimeout' },
  // Specific Igbo files
  { language: 'ig', key: 'postAIMenu' },
  { language: 'ig', key: 'languageTimeout' }
];

async function regenerateAudio() {
  console.log('🔄 Starting selective audio regeneration and Cloudinary upload...');
  
  // Validate required environment variables
  if (!config.spitch.apiKey) {
    console.error('❌ Please set SPITCH_API_KEY environment variable');
    process.exit(1);
  }
  
  if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
    console.error('❌ Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables');
    process.exit(1);
  }
  
  console.log(`📁 Using Cloudinary folder: ${config.cloudinary.folder}`);
  console.log(`☁️ Using Cloudinary cloud: ${config.cloudinary.cloudName}`);

  const client = new Spitch({ apiKey: config.spitch.apiKey });
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < filesToRegenerate.length; i++) {
    const { language, key } = filesToRegenerate[i];
    const text = staticTexts[language]?.[key];
    
    if (!text) {
      console.error(`❌ Text not found for ${language}_${key}`);
      failedCount++;
      continue;
    }

    console.log(`📄 Regenerating ${i + 1}/${filesToRegenerate.length}: ${language}_${key}`);

    try {
      // Generate audio using Spitch API
      const response = await client.speech.generate({
        text: text,
        language: language,
        voice: getVoiceForLanguage(language),
        format: 'mp3',
        model: 'legacy',
      });

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Generate publicId exactly like the original service does
      const publicId = generatePublicId(text, language, 'static', key);
      const fullPublicId = `${config.cloudinary.folder}/static/${publicId}`;
      
      console.log(`🏷️ Generated publicId: ${publicId}`);
      console.log(`📂 Full path: ${fullPublicId}`);

      console.log(`📤 Uploading to Cloudinary: ${fullPublicId}`);

      // Convert buffer to stream and upload with longer timeout
      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            public_id: fullPublicId,
            overwrite: true,
            format: 'mp3',
            timeout: 60000, // 60 second timeout
          },
          (error, result) => {
            if (error) {
              console.error(`❌ Cloudinary upload error:`, error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        stream.end(audioBuffer);
      });
      
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout after 60s')), 60000)
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]);
      console.log(`✅ Uploaded: ${language}_${key} -> ${result.secure_url}`);
      successCount++;
      
      // Small delay after successful upload
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Failed to process ${language}_${key}:`, error.message);
      failedCount++;
    }

    // Longer delay between requests to avoid rate limiting
    if (i + 1 < filesToRegenerate.length) {
      console.log(`⏳ Waiting 8 seconds before next request...`);
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }

  console.log(`\n🔄 Regeneration completed!`);
  console.log(`✅ Success: ${successCount}, ❌ Failed: ${failedCount}`);
  console.log(`\nFiles regenerated and uploaded to Cloudinary:`);
  console.log(`- All Yoruba files (12 files)`);
  console.log(`- Hausa: postAIMenu, languageTimeout`);
  console.log(`- Igbo: postAIMenu, languageTimeout`);
  console.log(`\nExisting files with same publicId have been replaced.`);
}

function getVoiceForLanguage(language) {
  const voices = {
    en: 'john',
    yo: 'sade',
    ha: 'amina',
    ig: 'amara',
  };
  return voices[language] || voices['en'];
}

function generatePublicId(text, language, type, textKey) {
  // Exact format: spitch_static_analysisWait_yo_new
  return `spitch_static_${textKey}_${language}_new`;
}

// Run the script
regenerateAudio().catch(console.error);