#!/bin/bash
# Script to deploy feature branch to server
# Run this ON THE SERVER (10.30.11.45)

echo "Pulling latest code..."
cd ~/STT-API-Server
git pull origin feature/add-openai-transcriptions-endpoint

echo "Rebuilding container..."
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose build --no-cache stt-api

echo "Starting container..."
docker compose up -d stt-api

echo "Waiting for startup..."
sleep 5

echo "Testing new endpoint..."
curl --insecure -X POST "https://10.30.11.45:8060/v1/audio/transcriptions" \
     -F file=@/home/agnes/voice-notes/users/jbeasley-VFRDZ3/meeting_notes/2026-01-11_22-49-21.wav \
     -F model=whisper-1

echo ""
echo "Done! Check the response above."
