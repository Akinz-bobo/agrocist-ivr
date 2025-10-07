// Quick test to see what hash the welcome message generates
const crypto = require('crypto');

const text = "Welcome to Agrocist, your trusted livestock farming partner. Press 1 for English, 2 for Yoruba, or 3 for Hausa.";
const language = 'en';
const speed = 1;
const pitch = 1;
const bitrate = 64;
const sampleRate = 22050;
const speechSpeed = 1.1;

const content = `v3-${text}-${language}-${speed}-${pitch}-${bitrate}-${sampleRate}-${speechSpeed}`;
const hash = crypto.createHash('md5').update(content).digest('hex');

console.log('Welcome message hash:', hash);
console.log('Looking for file:', `public/audio/${hash}_compressed.mp3`);

// Check if file exists
const fs = require('fs');
const filePath = `public/audio/${hash}_compressed.mp3`;
if (fs.existsSync(filePath)) {
  const stats = fs.statSync(filePath);
  console.log('✅ File exists!', stats.size, 'bytes');
} else {
  console.log('❌ File NOT found!');
  // List all files to see what we have
  const files = fs.readdirSync('public/audio').filter(f => f.endsWith('.mp3'));
  console.log('\nAvailable files:');
  files.forEach(f => console.log(' -', f));
}
