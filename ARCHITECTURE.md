# Agrocist IVR System - Complete Architecture Documentation

## Project Overview
**Agrocist IVR System** - An AI-powered Interactive Voice Response system for livestock farmers to:
- Access farm record information
- Get veterinary advice through AI
- Request veterinary consultations
- Purchase medications, treatments, and feed
- Receive multilingual support (English, Yoruba, Hausa)

## Architecture Phases

### Phase 1 (v0.1.0) - MVP
- Basic call handling with Africa's Talking
- English-only support
- AI-powered livestock farming queries
- Simple veterinary agent handoff
- Basic menu system

### Phase 2 (v0.2.0) - Enhanced Features
- Multi-language support (Yoruba, Hausa)
- Farm record integration
- Order management system
- Call recording and analytics

### Phase 3 (v1.0.0) - Full System
- Complete multilingual AI
- Advanced agent routing
- Payment integration
- Comprehensive analytics dashboard

## Complete System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Caller/PSTN   │───▶│ Africa's Talking│───▶│   IVR Gateway   │
│                 │    │   Voice API     │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        │                                 ▼                                 │
                        │                    ┌─────────────────┐                           │
                        │                    │ Load Balancer   │                           │
                        │                    │   (NGINX)       │                           │
                        │                    └─────────────────┘                           │
                        │                                 │                                 │
                        │          ┌─────────────────────┼─────────────────────┐          │
                        │          ▼                     ▼                     ▼          │
                        │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
                        │ │   IVR Service   │  │   IVR Service   │  │   IVR Service   │  │
                        │ │   Instance 1    │  │   Instance 2    │  │   Instance N    │  │
                        │ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
                        │          │                     │                     │          │
                        │          └─────────────────────┼─────────────────────┘          │
                        │                                 ▼                                 │
                        │                    ┌─────────────────┐                           │
                        │                    │  Service Mesh   │                           │
                        │                    │  (In-Memory)    │                           │
                        │                    └─────────────────┘                           │
                        │                                 │                                 │
                        │          ┌─────────────────────┼─────────────────────┐          │
                        │          ▼                     ▼                     ▼          │
                        │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
                        │ │  Language Svc   │  │   AI/LLM Svc    │  │  Agent Queue    │  │
                        │ │ (Translation)   │  │  (OpenAI/etc)   │  │   Service       │  │
                        │ └─────────────────┘  └─────────────────┘  └─────────────────┘  │
                        │          │                     │                     │          │
                        │          └─────────────────────┼─────────────────────┘          │
                        │                                 ▼                                 │
                        │                    ┌─────────────────┐                           │
                        │                    │    Database     │                           │
                        │                    │   (MongoDB)     │                           │
                        │                    └─────────────────┘                           │
                        └─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Core Technologies
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js with Helmet for security
- **Database:** MongoDB
- **Caching:** In-memory with file-based persistence
- **Message Queue:** (Future: Redis Pub/Sub + Bull Queue)
- **Containerization:** Docker + Kubernetes
- **Load Balancer:** NGINX with SSL termination

#### External Services
- **Voice Platform:** Africa's Talking Voice API
- **AI/LLM:** OpenAI GPT-4o (primary), Claude 3.5 (fallback)
- **Speech Services:** Google Cloud Speech API
- **Translation:** Google Translate API
- **TTS:** Google Cloud Text-to-Speech

### Complete Call Flow Architecture

```
1. CALL INITIATION
   ├── Caller dials Africa's Talking number
   ├── AT routes call to webhook endpoint
   └── IVR Gateway receives POST request

2. LANGUAGE SELECTION (Phase 2+)
   ├── Play welcome message: "Welcome to Agrocist. Press 1 for English, 2 for Yoruba, 3 for Hausa"
   ├── Capture DTMF input (timeout: 10 seconds)
   ├── Set session language preference
   └── Store in call context

3. MAIN MENU
   ├── Play menu: "Press 1 for Farm Records, 2 for Veterinary Help, 3 for Product Orders, 4 for Speak with Vet"
   ├── Capture DTMF input
   └── Route based on selection

4. FARM RECORDS (Option 1)
   ├── "Please say your farm ID or farmer name"
   ├── Process speech-to-text
   ├── Query farm database
   ├── Provide farm information via TTS
   └── Return to main menu

5. VETERINARY HELP (Option 2)
   ├── "Please describe your livestock issue after the beep"
   ├── Record user speech (max 30 seconds)
   ├── Convert speech-to-text
   ├── Send to AI LLM with veterinary knowledge
   ├── Generate expert response
   ├── Convert to speech and play
   └── Ask if they need more help

6. PRODUCT ORDERS (Option 3)
   ├── "Press 1 for Medications, 2 for Feed, 3 for Treatments"
   ├── Capture selection
   ├── List available products
   ├── Take order details
   └── Confirm order

7. VETERINARY CONSULTATION (Option 4)
   ├── Check veterinarian availability
   ├── If available: Transfer call
   ├── If unavailable: Schedule callback
   └── Provide estimated wait time

8. CALL TERMINATION
   ├── Thank user
   ├── Store call summary
   └── End call
```

### AI/LLM Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI LLM SERVICE LAYER                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LIVESTOCK VETERINARY KNOWLEDGE BASE                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ├── Cattle diseases and treatments                     │ │
│  │ ├── Poultry health management                          │ │
│  │ ├── Goat and sheep care                                │ │
│  │ ├── Pig farming best practices                         │ │
│  │ ├── Feed recommendations                               │ │
│  │ ├── Vaccination schedules                              │ │
│  │ ├── Common symptoms diagnosis                          │ │
│  │ └── Emergency care procedures                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  AI PROCESSING PIPELINE                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 1. Speech-to-Text → Audio to English text             │ │
│  │ 2. Intent Classification → Veterinary vs General      │ │
│  │ 3. Context Analysis → Animal type, symptoms, urgency  │ │
│  │ 4. Knowledge Retrieval → Relevant vet information     │ │
│  │ 5. Response Generation → Professional vet advice      │ │
│  │ 6. Confidence Scoring → Escalation if uncertain       │ │
│  │ 7. Text-to-Speech → Audio response delivery           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ESCALATION TRIGGERS                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ├── Emergency keywords: "dying", "bleeding", "urgent"  │ │
│  │ ├── Complex symptoms requiring diagnosis               │ │
│  │ ├── Medication dosage questions                        │ │
│  │ ├── Surgical procedure inquiries                       │ │
│  │ └── AI confidence score below 0.7                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Design

#### Farm Records Collection
```javascript
{
  _id: ObjectId,
  farmerId: String,
  farmerName: String,
  phoneNumber: String,
  location: String,
  livestock: [
    {
      animalType: String, // "cattle", "poultry", "goat", "sheep", "pig"
      breed: String,
      count: Number,
      age: String,
      healthStatus: String,
      lastVaccination: Date,
      feedType: String,
      notes: String
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

#### Call Logs Collection
```javascript
{
  _id: ObjectId,
  sessionId: String,
  callerNumber: String,
  farmerId: String,
  callDuration: Number,
  menuPath: [String],
  aiInteractions: [
    {
      userInput: String,
      aiResponse: String,
      confidence: Number,
      timestamp: Date
    }
  ],
  escalatedToAgent: Boolean,
  agentId: String,
  callSummary: String,
  createdAt: Date
}
```

#### Product Catalog Collection
```javascript
{
  _id: ObjectId,
  category: String, // "medication", "feed", "treatment"
  productName: String,
  description: String,
  animalType: [String],
  price: Number,
  availability: Boolean,
  dosageInstructions: String,
  createdAt: Date
}
```

### Performance Requirements

#### Scalability Targets
- **Concurrent Calls:** 500 simultaneous calls
- **Response Time:** < 3 seconds for AI processing
- **Uptime:** 99.9% availability
- **Language Support:** English, Yoruba, Hausa

#### Infrastructure Scaling
- **Auto-scaling:** Based on call volume
- **Load Balancing:** Round-robin with health checks
- **Caching:** In-memory and file-based for audio files
- **Audio Optimization:** Compressed MP3 files (~20-40KB) with persistent caching

### Security & Compliance

#### Data Protection
- **PII Encryption:** AES-256 for farmer data
- **Call Recording:** Secure storage with retention policies
- **API Security:** JWT authentication, rate limiting
- **Audit Logging:** All interactions tracked

#### Veterinary Compliance
- **Professional Standards:** Licensed veterinarian oversight
- **Disclaimer:** Clear limitations of AI advice
- **Emergency Protocols:** Direct routing for urgent cases
- **Record Keeping:** Consultation documentation

### Production Considerations

#### Environment Setup
- **Development:** Local setup with mock services
- **Production:** Secure configuration with proper logging and monitoring

#### Quality Assurance
- **Source Control:** Git with feature branches
- **Testing:** Unit, integration, and load tests
- **Monitoring:** Real-time alerts and dashboards

## Version Roadmap

### v0.1.0 (MVP) - Current
- Basic call handling
- English-only AI responses
- Simple menu system
- Veterinary agent handoff

### v0.2.0 - Enhanced
- Multi-language support
- Farm record integration
- Product ordering system
- Call analytics

### v0.3.0 - Advanced
- Speech recognition improvements
- Advanced AI responses
- Mobile app integration
- Payment processing

### v1.0.0 - Complete
- Full multilingual AI
- Complete farm management
- Advanced analytics
- Multi-channel support

This architecture provides a comprehensive foundation for building a scalable, AI-powered IVR system specifically tailored for livestock farming needs while maintaining professional veterinary standards.