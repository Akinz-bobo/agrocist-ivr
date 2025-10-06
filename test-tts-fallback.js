const axios = require('axios');

// Test TTS fallback behavior when TTS is unavailable
const BASE_URL = 'http://localhost:3000';

async function testTTSFallback() {
  console.log('🔧 Testing TTS Fallback Behavior\n');
  
  try {
    // First, let's temporarily break TTS by using invalid credentials
    console.log('📞 Testing Incoming Call with TTS Fallback...');
    
    const incomingCallData = {
      sessionId: 'FALLBACK_TEST_' + Date.now(),
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
    
    // Check the welcome message
    if (response.data.includes('This service is currently available in English only')) {
      console.log('✅ SUCCESS: English-only fallback detected in welcome message!');
    } else if (response.data.includes('Press 1 for English. Fún Èdè Yorùbá')) {
      console.log('🎵 TTS working: Multi-language options available');
    } else {
      console.log('❓ Unknown response format');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test language selection when TTS is down
    console.log('🗣️ Testing Language Selection Rejection (Yoruba)...');
    
    const yorubaResponse = await axios.post(`${BASE_URL}/voice/language`, {
      sessionId: incomingCallData.sessionId,
      dtmfDigits: '2', // Try to select Yoruba
      isActive: '1'
    });
    
    console.log('✅ Status:', yorubaResponse.status);
    console.log('📄 XML Response:');
    console.log(yorubaResponse.data);
    
    if (yorubaResponse.data.includes('This service is currently available in English only')) {
      console.log('✅ SUCCESS: Yoruba selection rejected, English-only message shown!');
    } else if (yorubaResponse.data.includes('Ẹ ti yan Èdè Yorùbá')) {
      console.log('🎵 TTS working: Yoruba selection accepted');
    } else {
      console.log('❓ Unexpected response for Yoruba selection');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test English selection (should always work)
    console.log('🗣️ Testing English Selection (should work)...');
    
    const englishResponse = await axios.post(`${BASE_URL}/voice/language`, {
      sessionId: 'ENGLISH_TEST_' + Date.now(),
      dtmfDigits: '1', // Select English
      isActive: '1'
    });
    
    console.log('✅ Status:', englishResponse.status);
    console.log('📄 XML Response:');
    console.log(englishResponse.data);
    
    if (englishResponse.data.includes('You have selected English') || 
        englishResponse.data.includes('<Record')) {
      console.log('✅ SUCCESS: English selection always works!');
    } else {
      console.log('❌ ERROR: English selection failed');
    }
    
    console.log('\n🎉 TTS Fallback Test Completed!');
    
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
    await testTTSFallback();
  } catch (error) {
    console.error('❌ Server not running. Please start it first:');
    console.error('   npm start');
  }
}

checkServer();