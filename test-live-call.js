const axios = require('axios');

// Test script to simulate Africa's Talking webhook calls
const BASE_URL = 'http://localhost:3000'; // Change to your ngrok URL when testing

async function testLiveIntegration() {
  console.log('🧪 Testing Live Africa\'s Talking Integration\n');
  
  // Test 1: Simulate incoming call from Africa's Talking
  try {
    console.log('📞 Testing Incoming Call Simulation...');
    
    const incomingCallData = {
      sessionId: 'AT_' + Date.now(),
      phoneNumber: '+2348012345678', // Simulated caller
      networkCode: 'MTN_NG',
      // This is what Africa's Talking sends when someone calls +2342017001117
    };
    
    const response = await axios.post(`${BASE_URL}/voice`, incomingCallData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Status:', response.status);
    console.log('📄 Response Preview:');
    console.log(response.data.substring(0, 500) + '...\n');
    
    // Extract session ID for follow-up tests
    const sessionId = incomingCallData.sessionId;
    
    // Test 2: Simulate DTMF input (Press 2 for Veterinary Help)
    console.log('📟 Testing DTMF Input (Press 2 for Veterinary Help)...');
    
    const dtmfResponse = await axios.post(`${BASE_URL}/voice/menu`, {
      sessionId: sessionId,
      dtmfDigits: '2'
    });
    
    console.log('✅ DTMF Response Preview:');
    console.log(dtmfResponse.data.substring(0, 500) + '...\n');
    
    // Test 3: Simulate veterinary menu selection
    console.log('🩺 Testing Veterinary Menu (Press 1 for Symptoms)...');
    
    const vetMenuResponse = await axios.post(`${BASE_URL}/voice/veterinary`, {
      sessionId: sessionId,
      dtmfDigits: '1'
    });
    
    console.log('✅ Veterinary Menu Response Preview:');
    console.log(vetMenuResponse.data.substring(0, 500) + '...\n');
    
    console.log('🎉 Live Integration Test Completed Successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Update your Africa\'s Talking callback URL to point to this server');
    console.log('2. Call +2342017001117 to test the live system');
    console.log('3. Follow the voice prompts and test the veterinary AI');
    
  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
  }
}

// Test configuration display
async function displayConfiguration() {
  console.log('📋 Current Configuration:');
  console.log('================================');
  console.log('🏃 Server Status: Checking...\n');
  
  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server Running:', health.data);
    console.log('');
    
    console.log('📞 Africa\'s Talking Configuration:');
    console.log('Phone Number: +2342017001117');
    console.log('Current Callback: https://api.africastalking.com/test/voice');
    console.log('Required Callback:', BASE_URL + '/voice');
    console.log('');
    
    console.log('🌐 Webhook Endpoints:');
    console.log('- Main Call Handler:', BASE_URL + '/voice');
    console.log('- Menu Selection:', BASE_URL + '/voice/menu');
    console.log('- Recording Handler:', BASE_URL + '/voice/recording');
    console.log('- Transfer Handler:', BASE_URL + '/voice/transfer');
    console.log('');
    
    await testLiveIntegration();
    
  } catch (error) {
    console.error('❌ Server not running. Please start it first:');
    console.error('   npm start');
  }
}

displayConfiguration();