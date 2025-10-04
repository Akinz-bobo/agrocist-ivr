const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data for various scenarios
const testCases = [
  {
    name: 'Incoming Call',
    endpoint: '/voice',
    data: {
      sessionId: 'test-session-001',
      phoneNumber: '+234800123456',
      networkCode: 'MTN_NG'
    }
  },
  {
    name: 'Main Menu - Veterinary Help',
    endpoint: '/voice/menu',
    data: {
      sessionId: 'test-session-001',
      dtmfDigits: '2'
    }
  },
  {
    name: 'Veterinary Menu - Describe Symptoms',
    endpoint: '/voice/veterinary',
    data: {
      sessionId: 'test-session-001',
      dtmfDigits: '1'
    }
  },
  {
    name: 'Recording - Cow Symptoms',
    endpoint: '/voice/recording',
    data: {
      sessionId: 'test-session-001',
      recordingUrl: 'https://test.com/recording.wav',
      durationInSeconds: 15
    }
  },
  {
    name: 'Product Menu - Medications',
    endpoint: '/voice/products',
    data: {
      sessionId: 'test-session-002',
      dtmfDigits: '1'
    }
  },
  {
    name: 'Transfer to Agent',
    endpoint: '/voice/transfer',
    data: {
      sessionId: 'test-session-001',
      hangupCause: 'NORMAL_CLEARING'
    }
  }
];

async function runTests() {
  console.log('🧪 Testing Agrocist IVR Webhooks\n');
  
  // Test health check first
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return;
  }

  console.log('\n📞 Testing Voice Endpoints:\n');

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      
      const response = await axios.post(`${BASE_URL}${testCase.endpoint}`, testCase.data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`📄 Response Type: ${response.headers['content-type']}`);
      
      if (response.headers['content-type']?.includes('xml')) {
        console.log(`🎤 XML Response Preview: ${response.data.substring(0, 200)}...`);
      } else {
        console.log(`📊 JSON Response:`, response.data);
      }
      
      console.log('---\n');
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ ${testCase.name} Failed:`, error.response?.data || error.message);
      console.log('---\n');
    }
  }
}

async function testInvalidRequests() {
  console.log('🚫 Testing Invalid Requests:\n');
  
  const invalidCases = [
    {
      name: 'Invalid DTMF',
      endpoint: '/voice/menu',
      data: {
        sessionId: 'test-session-001',
        dtmfDigits: 'abc'
      }
    },
    {
      name: 'Missing Session ID',
      endpoint: '/voice/menu',
      data: {
        dtmfDigits: '1'
      }
    }
  ];
  
  for (const testCase of invalidCases) {
    try {
      await axios.post(`${BASE_URL}${testCase.endpoint}`, testCase.data);
      console.log(`❌ ${testCase.name}: Should have failed but didn't`);
    } catch (error) {
      console.log(`✅ ${testCase.name}: Correctly rejected with status ${error.response?.status}`);
    }
  }
}

async function runFullTest() {
  try {
    await runTests();
    await testInvalidRequests();
    console.log('🎉 All tests completed!');
  } catch (error) {
    console.error('Test runner error:', error.message);
  }
}

// Check if server is running
axios.get(`${BASE_URL}/health`)
  .then(() => {
    runFullTest();
  })
  .catch(() => {
    console.log('❌ Server not running. Please start the server first:');
    console.log('   npm run dev');
  });