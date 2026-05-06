/**
 * One-time script to generate and upload the new static audio files:
 *   - welcome_en_gate  (new gate menu message)
 *   - premiumRequired_en_new  (premium subscription required message)
 *
 * Run with:
 *   npx ts-node scripts/upload-new-static-audio.ts
 *
 * After running, copy the printed Cloudinary URLs into the overrides map
 * in staticAudioService.getStaticAudioUrl().
 */

import dotenv from "dotenv";
dotenv.config();

import Spitch from "spitch";
import { v2 as cloudinary } from "cloudinary";

const SPITCH_API_KEY = process.env.SPITCH_API_KEY!;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER ?? "agrocist-ivr/audio";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const client = new Spitch({ apiKey: SPITCH_API_KEY });

const FILES_TO_GENERATE = [
  {
    publicId: "welcome_en_gate",
    language: "en" as const,
    voice: "john",
    text: "Welcome to Agrocist, your trusted livestock farming partner. Press 1 to speak with our AI veterinary assistant, or press 2 to speak with a human agent.",
  },
  {
    publicId: "premiumRequired_en_new",
    language: "en" as const,
    voice: "john",
    text: "Speaking with a human agent is a premium feature. Please subscribe to Agrocist Premium to access this service. Thank you for calling.",
  },
];

async function generateAndUpload(file: typeof FILES_TO_GENERATE[0]): Promise<string> {
  console.log(`\nGenerating: ${file.publicId}`);
  console.log(`  Text: "${file.text.substring(0, 60)}..."`);

  const response = await client.speech.generate({
    text: file.text,
    language: file.language,
    voice: file.voice as any,
    format: "mp3",
    model: "legacy",
  });

  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());
  console.log(`  Generated: ${buffer.length} bytes`);

  const base64Data = `data:audio/mp3;base64,${buffer.toString("base64")}`;

  const result = await cloudinary.uploader.upload(base64Data, {
    resource_type: "video",
    public_id: file.publicId,
    folder: `${CLOUDINARY_FOLDER}/static`,
    overwrite: true,
    format: "mp3",
  });

  console.log(`  ✅ Uploaded: ${result.secure_url}`);
  return result.secure_url;
}

async function main() {
  console.log("=== Uploading new static audio files ===\n");

  const results: Record<string, string> = {};

  for (const file of FILES_TO_GENERATE) {
    try {
      results[file.publicId] = await generateAndUpload(file);
    } catch (error) {
      console.error(`  ❌ Failed for ${file.publicId}:`, error);
    }
  }

  console.log("\n=== Done. Paste these URLs into staticAudioService.getStaticAudioUrl() ===\n");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  "${id}": "${url}"`);
  }
}

main().catch(console.error);
