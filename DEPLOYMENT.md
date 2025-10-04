# Deployment Guide - Agrocist IVR System

This guide covers deploying the Agrocist IVR system for production use with Africa's Talking.

## Prerequisites

### Development Environment
- Node.js 20+
- Redis server
- Git
- Africa's Talking account
- OpenAI API key
- Domain name with SSL certificate

### Production Requirements
- Cloud server (AWS, Google Cloud, Azure, DigitalOcean)
- Redis instance (managed or self-hosted)
- Load balancer (optional for high availability)
- Monitoring tools
- Backup strategy

## Quick Start (Development)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd agrocist-ivr
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
# Server
PORT=3000
NODE_ENV=development

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

### 3. Start Redis
```bash
# macOS
brew services start redis

# Ubuntu
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### 4. Start Application
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Test Local Setup
```bash
node test-webhook.js
```

## Production Deployment

### Option 1: Cloud Server (Recommended)

#### DigitalOcean Droplet
```bash
# Create droplet with Ubuntu 22.04
# SSH into server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install Redis
apt update
apt install redis-server -y

# Install PM2 for process management
npm install -g pm2

# Clone repository
git clone <your-repo-url>
cd agrocist-ivr
npm install
```

#### Configure Environment
```bash
# Create production environment file
cp .env.example .env
nano .env

# Build application
npm run build

# Start with PM2
pm2 start dist/index.js --name agrocist-ivr
pm2 startup
pm2 save
```

#### Setup Nginx (Reverse Proxy)
```bash
# Install Nginx
apt install nginx -y

# Create configuration
nano /etc/nginx/sites-available/agrocist-ivr
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/agrocist-ivr /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate
certbot --nginx -d your-domain.com

# Auto-renewal
crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Docker Deployment

#### Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
```

Deploy with Docker:
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

### Option 3: Heroku Deployment

#### Prepare for Heroku
```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create agrocist-ivr

# Add Redis addon
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set AT_API_KEY=your_api_key
heroku config:set AT_USERNAME=your_username
heroku config:set AT_SHORT_CODE=your_phone_number
heroku config:set OPENAI_API_KEY=your_openai_key
heroku config:set WEBHOOK_BASE_URL=https://your-app.herokuapp.com
```

#### Procfile
```
web: npm start
```

#### Deploy
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## Africa's Talking Configuration

### 1. Voice Number Setup
1. Login to Africa's Talking Dashboard
2. Go to Voice → Numbers
3. Purchase a voice number for your country
4. Note the short code for your `.env` file

### 2. Webhook Configuration
1. Go to Voice → Settings
2. Set Primary Callback URL: `https://your-domain.com/voice`
3. Set Notification URL: `https://your-domain.com/voice/end`
4. Enable voice notifications

### 3. Test Configuration
```bash
# Test webhook endpoint
curl -X POST https://your-domain.com/voice \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test123",
    "phoneNumber": "+234800123456",
    "networkCode": "MTN_NG"
  }'
```

## Production Monitoring

### 1. Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs agrocist-ivr

# Restart application
pm2 restart agrocist-ivr
```

### 2. System Monitoring
Install monitoring tools:
```bash
# Install monitoring
npm install -g pm2-logrotate
pm2 install pm2-server-monit

# Setup log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 3. Health Checks
```bash
# Basic health check
curl https://your-domain.com/health

# Detailed monitoring script
#!/bin/bash
ENDPOINT="https://your-domain.com/health"
RESPONSE=$(curl -s $ENDPOINT)
if [[ $RESPONSE == *"healthy"* ]]; then
    echo "✅ Service is healthy"
else
    echo "❌ Service is unhealthy"
    # Send alert (email, SMS, etc.)
fi
```

## Security Configuration

### 1. Firewall Setup
```bash
# UFW firewall
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

### 2. Redis Security
```bash
# Edit Redis config
nano /etc/redis/redis.conf

# Add password
requirepass your_redis_password

# Restart Redis
systemctl restart redis-server
```

Update `.env`:
```bash
REDIS_URL=redis://:your_redis_password@localhost:6379
```

### 3. Application Security
- Use HTTPS everywhere
- Implement rate limiting
- Regular security updates
- Monitor for suspicious activity
- Backup data regularly

## Backup Strategy

### 1. Application Backup
```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
APP_DIR="/path/to/agrocist-ivr"

# Create backup
tar -czf $BACKUP_DIR/agrocist-ivr_$DATE.tar.gz $APP_DIR

# Keep only last 7 days
find $BACKUP_DIR -name "agrocist-ivr_*.tar.gz" -mtime +7 -delete
```

### 2. Redis Backup
```bash
# Redis backup
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

## Scaling

### 1. Horizontal Scaling
```bash
# Load balancer with multiple instances
pm2 start dist/index.js -i max --name agrocist-ivr
```

### 2. Database Scaling
```bash
# Redis cluster or managed Redis
# Update REDIS_URL to cluster endpoint
```

### 3. Monitoring Scaling
Set up alerts for:
- CPU usage > 80%
- Memory usage > 80%
- Response time > 5 seconds
- Error rate > 5%

## Troubleshooting

### Common Issues

#### 1. Webhook Not Receiving Calls
```bash
# Check webhook URL
curl -I https://your-domain.com/voice

# Check Africa's Talking configuration
# Verify SSL certificate
openssl s_client -connect your-domain.com:443
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Check connection from app
redis-cli -u $REDIS_URL ping
```

#### 3. AI Service Errors
```bash
# Test OpenAI API
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check API quota
```

### Log Analysis
```bash
# View application logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# PM2 logs
pm2 logs agrocist-ivr --lines 100
```

## Performance Optimization

### 1. Caching Strategy
- Implement Redis caching for AI responses
- Cache static content with CDN
- Use connection pooling

### 2. Database Optimization
- Index frequently queried fields
- Implement read replicas
- Monitor query performance

### 3. Application Optimization
- Enable gzip compression
- Optimize Docker images
- Use PM2 cluster mode

## Maintenance

### 1. Regular Updates
```bash
# Update dependencies
npm audit
npm update

# Security patches
apt update && apt upgrade
```

### 2. Performance Monitoring
```bash
# Monitor metrics
pm2 monit

# Check memory usage
free -h

# Check disk usage
df -h
```

### 3. Log Management
```bash
# Rotate logs
logrotate -f /etc/logrotate.conf

# Clean old logs
find logs/ -name "*.log" -mtime +30 -delete
```

This deployment guide provides a comprehensive approach to getting your Agrocist IVR system running in production with proper monitoring, security, and scalability considerations.