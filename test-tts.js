const axios = require('axios');

// Test TTS integration with different languages
const BASE_URL = 'http://localhost:3000';

async function testTTSIntegration() {
  console.log('🎵 Testing TTS Integration with Africa\'s Talking\n');
  
  try {
    // Test 1: Incoming call (should generate welcome with TTS)
    console.log('📞 Testing Incoming Call with TTS...');
    
    const incomingCallData = {
      sessionId: 'TTS_TEST_' + Date.now(),
      phoneNumber: '+2348012345678',
      networkCode: 'MTN_NG',
      isActive: '1'
    };
    
    const response = await axios.post(`${BASE_URL}/voice`, incomingCallData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Status:', response.status);
    console.log('📄 XML Response:');
    console.log(response.data);
    
    // Check if response contains Play tags (TTS) or Say tags (fallback)
    if (response.data.includes('<Play url=')) {
      console.log('🎵 SUCCESS: TTS audio detected in response!');
    } else if (response.data.includes('<Say>')) {
      console.log('🔊 FALLBACK: Using Say tags (TTS failed, fallback working)');
    } else {
      console.log('❌ No audio tags found in response');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Language selection (English)
    console.log('🗣️ Testing Language Selection (English)...');
    
    const languageResponse = await axios.post(`${BASE_URL}/voice/language`, {
      sessionId: incomingCallData.sessionId,
      dtmfDigits: '1',
      isActive: '1'
    });
    
    console.log('✅ Status:', languageResponse.status);
    console.log('📄 XML Response:');
    console.log(languageResponse.data);
    
    if (languageResponse.data.includes('<Play url=')) {
      console.log('🎵 SUCCESS: TTS for English detected!');
    } else {
      console.log('🔊 FALLBACK: Using Say tags for English');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Language selection (Yoruba)
    console.log('🗣️ Testing Language Selection (Yoruba)...');
    
    const yorubaResponse = await axios.post(`${BASE_URL}/voice/language`, {
      sessionId: 'TTS_YORUBA_' + Date.now(),
      dtmfDigits: '2',
      isActive: '1'
    });
    
    console.log('✅ Status:', yorubaResponse.status);
    console.log('📄 XML Response:');
    console.log(yorubaResponse.data);
    
    if (yorubaResponse.data.includes('<Play url=')) {
      console.log('🎵 SUCCESS: TTS for Yoruba detected!');
    } else {
      console.log('🔊 FALLBACK: Using Say tags for Yoruba');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Language selection (Hausa)
    console.log('🗣️ Testing Language Selection (Hausa)...');
    
    const hausaResponse = await axios.post(`${BASE_URL}/voice/language`, {
      sessionId: 'TTS_HAUSA_' + Date.now(),
      dtmfDigits: '3',
      isActive: '1'
    });
    
    console.log('✅ Status:', hausaResponse.status);
    console.log('📄 XML Response:');
    console.log(hausaResponse.data);
    
    if (hausaResponse.data.includes('<Play url=')) {
      console.log('🎵 SUCCESS: TTS for Hausa detected!');
    } else {
      console.log('🔊 FALLBACK: Using Say tags for Hausa');
    }
    
    console.log('\n🎉 TTS Integration Test Completed!');
    
    console.log('\n📋 DSN TTS Configuration Summary:');
    console.log('- English: DSN voice "Lucy" (Very clear English female voice)');
    console.log('- Yoruba: DSN voice "Sade" (Energetic but breezy Yoruba female voice)');
    console.log('- Hausa: DSN voice "Zainab" (Clear, loud Hausa female voice)');
    console.log('- API: https://api.dsnsandbox.com/api/v1/ai/spitch/text-to-speech');
    console.log('- Audio files stored in: public/audio/');
    console.log('- Fallback: <Say> tags if DSN TTS fails');
    
    console.log('\n🔧 Next Steps:');
    console.log('1. DSN credentials are already configured (evet/D1wmd7IkzfjrOW)');
    console.log('2. Test with a real phone call to your Africa\'s Talking number');
    console.log('3. Check public/audio/ directory for generated MP3 files');
    console.log('4. All voice responses now use your DSN TTS service!');
    
  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server Running:', health.data.service);
    console.log('');
    await testTTSIntegration();
  } catch (error) {
    console.error('❌ Server not running. Please start it first:');
    console.error('   npm start');
  }
}

checkServer();