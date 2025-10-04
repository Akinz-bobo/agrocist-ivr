# Agrocist IVR System v0.1.0

An AI-powered Interactive Voice Response (IVR) system designed specifically for livestock farmers in Nigeria. Built with Node.js, TypeScript, and integrated with Africa's Talking Voice API.

## Features

### Current Version (v0.1.0)
- ✅ Basic call handling with Africa's Talking
- ✅ English-language support
- ✅ AI-powered veterinary advice using OpenAI GPT-4o
- ✅ Multi-level menu system (Farm Records, Veterinary Help, Product Orders, Agent Transfer)
- ✅ Comprehensive livestock knowledge base (cattle, poultry, goats, sheep, pigs)
- ✅ Veterinary agent handoff capability
- ✅ Call session management with Redis
- ✅ Detailed logging and monitoring

### Upcoming Features
- 🔄 Multi-language support (Yoruba, Hausa) - v0.2.0
- 🔄 Farm record integration - v0.2.0
- 🔄 Product ordering system - v0.2.0
- 🔄 Advanced speech recognition - v0.3.0
- 🔄 Mobile app integration - v1.0.0

## Architecture

The system follows a microservices-inspired architecture with the following components:

```
Caller → Africa's Talking → IVR Gateway → AI Service → Response
                                     ↓
                            Session Manager (Redis)
                                     ↓
                              Knowledge Base
```

## Quick Start

### Prerequisites
- Node.js 20+
- Redis server
- MongoDB (for future versions)
- Africa's Talking account
- OpenAI API key

### Installation

1. **Clone and setup:**
```bash
git clone <repository-url>
cd agrocist-ivr
npm install
```

2. **Environment Configuration:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables:**
```bash
# Africa's Talking
AT_API_KEY=your_api_key_here
AT_USERNAME=your_username_here
AT_SHORT_CODE=your_phone_number

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
REDIS_URL=redis://localhost:6379

# Webhook
WEBHOOK_BASE_URL=https://your-domain.com
```

4. **Start Development Server:**
```bash
npm run dev
```

5. **Build for Production:**
```bash
npm run build
npm start
```

## API Endpoints

### Voice Webhooks
- `POST /voice` - Main incoming call handler
- `POST /voice/menu` - Menu selection handler
- `POST /voice/products` - Product menu handler
- `POST /voice/veterinary` - Veterinary menu handler
- `POST /voice/recording` - Voice recording processor
- `POST /voice/transfer` - Agent transfer handler
- `POST /voice/end` - Call termination handler

### System
- `GET /health` - Health check endpoint
- `GET /` - Service information

## Call Flow

### 1. Welcome Message
```
"Welcome to Agrocist, your trusted livestock farming partner. 
We provide veterinary support, farm record management, and quality agricultural products."
```

### 2. Main Menu Options
- **Press 1:** Farm records and information
- **Press 2:** Veterinary help and advice
- **Press 3:** Product orders and purchases
- **Press 4:** Speak with veterinary expert

### 3. Veterinary Help Submenu
- **Press 1:** Describe animal symptoms
- **Press 2:** General health advice
- **Press 3:** Vaccination schedules
- **Press 4:** Speak with veterinarian

### 4. AI Processing
The system uses advanced AI to:
- Analyze livestock symptoms and provide expert advice
- Recommend treatments and preventive measures
- Determine urgency levels for veterinary intervention
- Provide vaccination schedules for different animals

## Supported Livestock

### Animals Covered
- **Cattle** (cows, bulls, calves)
- **Poultry** (chickens, birds)
- **Goats** (does, bucks, kids)
- **Sheep** (ewes, rams, lambs)
- **Pigs** (swine, piglets)

### Knowledge Areas
- Disease diagnosis and treatment
- Vaccination schedules
- Nutritional advice
- Preventive care
- Emergency conditions
- General farm management

## Configuration

### Africa's Talking Setup
1. Create account at [Africa's Talking](https://africastalking.com)
2. Purchase a voice number
3. Set webhook URL to: `https://your-domain.com/voice`
4. Configure API credentials in `.env`

### OpenAI Setup
1. Get API key from [OpenAI](https://platform.openai.com)
2. Add to `.env` file
3. Ensure sufficient credits for API usage

### Redis Setup
```bash
# Install Redis
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu

# Start Redis
redis-server
```

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── models/          # Data models (future)
├── routes/          # API routes
├── services/        # Business logic
├── types/           # TypeScript types
└── utils/           # Utility functions
```

### Key Services

#### AIService
Processes veterinary queries using OpenAI GPT-4o with specialized prompts for livestock farming.

#### AfricasTalkingService
Handles voice call management, DTMF processing, and XML response generation.

#### KnowledgeBase
Comprehensive database of livestock health information, treatments, and preventive care.

#### SessionManager
Redis-based session management for maintaining call state and context.

### Scripts
```bash
npm run dev          # Development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start           # Production server
npm test            # Run tests
npm run lint        # Code linting
npm run lint:fix    # Fix linting issues
```

## Testing

### Manual Testing
1. Call your Africa's Talking number
2. Follow the menu prompts
3. Test different scenarios:
   - Describe animal symptoms
   - Request vaccination info
   - Transfer to agent

### Integration Testing
```bash
# Test webhook endpoints
curl -X POST http://localhost:3000/voice \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","phoneNumber":"+234XXXXXXXXX"}'
```

## Deployment

### Using Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Setup
- **Development:** Local setup with ngrok for webhooks
- **Staging:** Cloud deployment with staging credentials
- **Production:** Multi-region deployment with load balancing

## Monitoring

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Console output in development mode

### Metrics
- Call volume and duration
- AI response accuracy
- Menu navigation patterns
- Agent transfer rates

## Security

### Implemented Measures
- Request validation with Joi
- Helmet.js security headers
- CORS configuration
- Input sanitization
- Error handling without data leakage

### Recommendations
- Use HTTPS in production
- Implement rate limiting
- Regular security audits
- Monitor for suspicious activity

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes with tests
4. Commit: `git commit -m 'Add new feature'`
5. Push: `git push origin feature/new-feature`
6. Create Pull Request

## Support

### Documentation
- Full architecture: `ARCHITECTURE.md`
- API documentation: Generated from code
- Knowledge base: Documented in codebase

### Contact
- Technical Issues: Create GitHub issue
- Business Inquiries: Contact Agrocist team
- Emergency Support: Use agent transfer feature

## License

MIT License - see LICENSE file for details.

## Changelog

### v0.1.0 (Current)
- Initial MVP release
- Basic IVR functionality
- AI-powered veterinary advice
- English language support
- Agent handoff capability

### Roadmap
- **v0.2.0:** Multi-language support, farm records
- **v0.3.0:** Advanced speech recognition, mobile integration
- **v1.0.0:** Complete feature set, multi-channel support

---

Built with ❤️ for African farmers by the Agrocist team.