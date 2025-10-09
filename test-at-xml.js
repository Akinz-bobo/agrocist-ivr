const express = require('express');
const app = express();
const port = 3001;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Test endpoint to show proper Africa's Talking XML
app.post('/test-welcome', (req, res) => {
  console.log('=== WELCOME TEST ===');
  console.log('Body:', req.body);
  
  const welcomeXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits timeout="10" finishOnKey="#" callbackUrl="http://localhost:3001/test-menu">
    <Say voice="en-US-Standard-C" playBeep="false">
      <speak>
        <prosody rate="medium" pitch="medium">
          Welcome to <emphasis level="strong">Agrocist</emphasis>, your trusted livestock farming partner.
          <break time="500ms"/>
          Press <say-as interpret-as="cardinal">1</say-as> for English,
          <break time="200ms"/>
          Press <say-as interpret-as="cardinal">2</say-as> for Yoruba,
          <break time="200ms"/>
          or Press <say-as interpret-as="cardinal">3</say-as> for Hausa.
        </prosody>
      </speak>
    </Say>
  </GetDigits>
</Response>`;

  res.set('Content-Type', 'application/xml');
  res.send(welcomeXML);
});

// Test menu selection
app.post('/test-menu', (req, res) => {
  console.log('=== MENU TEST ===');
  console.log('Body:', req.body);
  
  const { dtmfDigits } = req.body;
  let responseXML = '';
  
  switch(dtmfDigits) {
    case '1': // English
      responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="http://localhost:3001/test-recording">
    <Say voice="en-US-Standard-C" playBeep="false">You have selected English. Please describe your livestock concern. Speak clearly after the beep and press hash when done.</Say>
  </Record>
</Response>`;
      break;
      
    case '2': // Yoruba
      responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" trimSilence="true" playBeep="true" finishOnKey="#" callbackUrl="http://localhost:3001/test-recording">
    <Say voice="en-US-Standard-C" playBeep="false">Ẹ ti yan Èdè Yorùbá. Ẹ sọ ìṣòro ẹranko yín kedere lẹ́yìn ìró àlámọ́, kí ẹ sì tẹ́ hash nígbà tí ẹ bá parí.</Say>
  </Record>
</Response>`;
      break;
      
    case '0': // End call
      responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-C" playBeep="false">Thank you for using Agrocist. Have a great day!</Say>
</Response>`;
      break;
      
    default:
      responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect>http://localhost:3001/test-welcome</Redirect>
</Response>`;
  }
  
  res.set('Content-Type', 'application/xml');
  res.send(responseXML);
});

// Test recording handler
app.post('/test-recording', (req, res) => {
  console.log('=== RECORDING TEST ===');
  console.log('Body:', req.body);
  
  const { recordingUrl, isActive } = req.body;
  
  if (isActive === "0") {
    console.log('Call ended, recording URL:', recordingUrl);
    res.status(200).send('');
    return;
  }
  
  // Simulate AI processing response
  const responseXML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="en-US-Standard-C" playBeep="false">Thank you for your question. Based on your description, I recommend consulting with a veterinarian immediately. This could be a serious condition that requires professional attention.</Say>
  <GetDigits timeout="8" finishOnKey="#" callbackUrl="http://localhost:3001/test-menu">
    <Say voice="en-US-Standard-C" playBeep="false">Press 1 to speak with a human expert, or press 0 to end the call.</Say>
  </GetDigits>
</Response>`;
  
  res.set('Content-Type', 'application/xml');
  res.send(responseXML);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'at-xml-test' });
});

app.listen(port, () => {
  console.log(`Africa's Talking XML Test Server running at http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  POST /test-welcome - Test welcome message with SSML');
  console.log('  POST /test-menu - Test menu selection');
  console.log('  POST /test-recording - Test recording handling');
  console.log('  GET /health - Health check');
});