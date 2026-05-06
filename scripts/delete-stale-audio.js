/**
 * Deletes stale static audio files from Cloudinary so they are regenerated
 * with updated text on the next server startup.
 *
 * Usage:
 *   node scripts/delete-stale-audio.js
 */

require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Public IDs to delete — add any other stale files here
const STALE_FILES = [
  "agrocist-ivr/audio/static/welcome_en_new", // old language-menu welcome (stale)
  "agrocist-ivr/audio/static/welcome_en_gate", // delete if a bad version was uploaded
];

async function deleteStaleFiles() {
  console.log(
    `Deleting ${STALE_FILES.length} stale file(s) from Cloudinary...\n`,
  );

  for (const publicId of STALE_FILES) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });
      if (result.result === "ok") {
        console.log(`✅ Deleted: ${publicId}`);
      } else if (result.result === "not found") {
        console.log(`⚠️  Not found (already deleted?): ${publicId}`);
      } else {
        console.log(`❌ Unexpected result for ${publicId}:`, result);
      }
    } catch (error) {
      console.error(`❌ Error deleting ${publicId}:`, error.message);
    }
  }

  console.log("\nDone. Restart the server to regenerate the deleted files.");
}

deleteStaleFiles();
