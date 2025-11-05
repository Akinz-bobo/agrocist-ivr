# Docker Setup for Agrocist IVR

## Quick Start

1. **Copy environment file and add your credentials:**
   ```bash
   cp .env.docker .env
   ```
   
2. **Edit `.env` file with your actual credentials:**
   - OpenAI API Key
   - Africa's Talking credentials
   - MongoDB connection string
   - Cloudinary credentials
   - DSN TTS credentials

3. **Start the container:**
   ```bash
   ./start-docker.sh
   ```

## Manual Docker Commands

```bash
# Build and run
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down

# Restart container
docker-compose restart
```

## Health Check

Visit: http://localhost:3000/health

## Environment Variables Required

- `OPENAI_API_KEY`: Your OpenAI API key
- `AT_API_KEY`: Africa's Talking API key
- `MONGODB_URI`: MongoDB connection string
- `CLOUDINARY_*`: Cloudinary credentials
- `DSN_*`: DSN TTS credentials
- `WEBHOOK_BASE_URL`: Your public webhook URL