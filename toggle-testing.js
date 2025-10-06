#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

function updateEnvVar(key, value) {
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  const regex = new RegExp(`^${key}=.*`, 'gm');
  const newLine = `${key}=${value}`;
  
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, newLine);
  } else {
    envContent += `\n${newLine}`;
  }
  
  fs.writeFileSync(envPath, envContent);
}

const command = process.argv[2];

switch (command) {
  case 'on':
    updateEnvVar('USE_SAY_ONLY', 'true');
    updateEnvVar('FORCE_ENGLISH_ONLY', 'true');
    console.log('✅ Testing mode ON - Using Say tags only in English');
    console.log('Restart the server to apply changes: npm start');
    break;
    
  case 'off':
    updateEnvVar('USE_SAY_ONLY', 'false');
    updateEnvVar('FORCE_ENGLISH_ONLY', 'false');
    console.log('✅ Testing mode OFF - Using TTS/Play tags with all languages');
    console.log('Restart the server to apply changes: npm start');
    break;
    
  default:
    console.log('Usage:');
    console.log('  node toggle-testing.js on   - Enable Say-only English testing mode');
    console.log('  node toggle-testing.js off  - Disable testing mode (use TTS)');
    break;
}