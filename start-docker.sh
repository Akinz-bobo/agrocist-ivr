#!/bin/bash

echo "🐳 Starting Agrocist IVR Docker Container..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Copy environment file for Docker
cp .env.docker .env

# Build and start the container
docker-compose up --build -d

echo "✅ Container started successfully!"
echo "📊 Check status: docker-compose ps"
echo "📋 View logs: docker-compose logs -f"
echo "🌐 Application running at: http://localhost:3000"
echo "🔍 Health check: http://localhost:3000/health"