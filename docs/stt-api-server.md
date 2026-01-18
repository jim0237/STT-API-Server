# STT-API-Server Installation, Deployment, and Update Guide

## Summary

**STT-API-Server** is a speech-to-text REST API using Faster Whisper. It is deployed via Docker and updates are pulled directly from GitHub.

| Aspect | Details |
|--------|---------|
| **Source Code** | GitHub: `https://github.com/jim0237/STT-API-Server` |
| **Deployment Method** | Docker (via Dockge or docker compose) |
| **Update Method** | `git pull` from GitHub, then rebuild container |
| **Server Location** | `http://10.30.11.45:8060` |
| **Protocol** | HTTP (no SSL) |
| **GPU Requirement** | NVIDIA GPU with CUDA 12.6 support |

### Quick Update Workflow

```bash
# On the server (10.30.11.45)
cd ~/STT-API-Server
git pull origin main
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose build --no-cache stt-api
docker compose up -d stt-api
```

### Verify Update

```bash
curl http://10.30.11.45:8060/health
```

---

## Protocol: HTTP vs HTTPS

**Current Configuration: HTTP (no SSL)**

The server currently runs on HTTP without SSL encryption. This was changed to support CAAL integration, which expects HTTP connections by default.

**Why HTTP?**
- CAAL's bundled STT/TTS services use HTTP on internal Docker networks
- Simpler configuration - no certificate trust issues
- Lower latency (no SSL handshake)
- Acceptable for trusted local networks

**Re-enabling HTTPS (if needed later):**

To restore HTTPS support, modify the `if __name__ == "__main__":` block in `main-ui.py`:

```python
# Current (HTTP):
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )

# To restore HTTPS:
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem"
    )
```

The Dockerfile still generates SSL certificates (`cert.pem`, `key.pem`) during build, so they're available if needed.

---

## Directory Structure

### On the Server (10.30.11.45)

```
~/STT-API-Server/                    # Source code (cloned from GitHub)
├── main-ui.py                       # Main application file
├── Dockerfile                       # Container build instructions
├── docker-compose.yml               # Local compose file (not used by Dockge)
├── requirements.txt                 # Python dependencies
├── templates/                       # Web UI templates
│   ├── index.html
│   └── static/                      # CSS, JS assets
├── docs/                            # Documentation
└── deploy-feature-branch.sh         # Deployment helper script

~/ai-toolbox-container-deployment/   # Dockge deployment repository
└── stacks/
    └── stt-service/
        └── compose.yaml             # Dockge compose file (used for deployment)

~/voice-notes/                       # Persistent data (mounted into container)
├── users/                           # User-specific voice notes
│   └── {username}-{code}/
│       ├── daily_notes/
│       ├── meeting_notes/
│       ├── ideas/
│       └── research/
└── users.txt                        # User code mapping file
```

### Inside the Docker Container

```
/app/                                # Application root
├── main-ui.py                       # Application (copied from source)
├── templates/                       # Web UI templates
├── models/                          # Whisper models (downloaded on first run)
├── output/                          # Transcription output files
├── uploads/                         # Temporary upload storage
├── vnotes/                          # Voice notes (mounted from host)
├── cert.pem                         # SSL certificate (generated at build, unused)
└── key.pem                          # SSL private key (generated at build, unused)
```

### Docker Volumes

| Volume | Host Path | Container Path | Purpose |
|--------|-----------|----------------|---------|
| `stt_models` | Docker managed | `/app/models` | Whisper model cache |
| `stt_cache` | Docker managed | `/app/cache` | Application cache |
| Voice notes | `/home/agnes/voice-notes` | `/app/vnotes` | User voice notes storage |

---

## Installation

### Prerequisites

On the deployment server:
- Docker with nvidia-container-toolkit
- NVIDIA GPU with CUDA 12.6 support
- Git
- Dockge (optional, for container management UI)

### Initial Setup

1. **Clone the source repository:**
   ```bash
   cd ~
   git clone https://github.com/jim0237/STT-API-Server.git
   ```

2. **Create the Dockge stack directory:**
   ```bash
   mkdir -p ~/ai-toolbox-container-deployment/stacks/stt-service
   ```

3. **Create the compose.yaml file:**
   ```yaml
   services:
     stt-api:
       build:
         context: ../../../STT-API-Server
         dockerfile: Dockerfile
       restart: unless-stopped
       ports:
         - 8060:8000
       volumes:
         - stt_models:/app/models
         - stt_cache:/app/cache
         - /home/agnes/voice-notes:/app/vnotes
       deploy:
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: 1
                 capabilities:
                   - gpu
       labels:
         - dockge.description=Custom STT API Server
         - dockge.icon=headphones

   volumes:
     stt_models:
       name: stt-models
     stt_cache:
       name: stt-cache
   ```

4. **Create voice notes directory:**
   ```bash
   mkdir -p ~/voice-notes/users
   ```

5. **Build and start the container:**
   ```bash
   cd ~/ai-toolbox-container-deployment/stacks/stt-service
   docker compose build stt-api
   docker compose up -d stt-api
   ```

6. **Verify the service is running:**
   ```bash
   curl http://10.30.11.45:8060/health
   ```

---

## Deployment Architecture

### How It Works

1. **Source Code**: Lives in `~/STT-API-Server/` (cloned from GitHub)
2. **Build Context**: Dockge's `compose.yaml` references the source directory via relative path (`../../../STT-API-Server`)
3. **Build Process**: Docker builds the image from the source code using the Dockerfile
4. **Container Runtime**: The built image runs as a container with mounted volumes for persistence

### Key Configuration

**Port Mapping:**
- External: `8060` (what users/CAAL access)
- Internal: `8000` (what the app listens on)

**Protocol:**
- HTTP (no SSL) - for CAAL compatibility
- SSL certificates exist in container but are not used

**GPU Access:**
- Container has access to NVIDIA GPU via nvidia-container-toolkit
- Uses CUDA 12.6 base image

---

## Updating the Service

Updates are pulled directly from GitHub. The source code is **not** modified locally - all changes come from the remote repository.

### Standard Update Process

```bash
# 1. SSH to the server
ssh user@10.30.11.45

# 2. Pull latest code from GitHub
cd ~/STT-API-Server
git pull origin main

# 3. Rebuild the container
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose build --no-cache stt-api

# 4. Restart with new build
docker compose up -d stt-api

# 5. Verify the update
curl http://10.30.11.45:8060/health
```

### Feature Branch Testing

To test a feature branch before merging to main:

```bash
# 1. Checkout the feature branch
cd ~/STT-API-Server
git fetch origin
git checkout feature/branch-name

# 2. Rebuild and restart
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose build --no-cache stt-api
docker compose up -d stt-api

# 3. Test the feature

# 4. Switch back to main when done
cd ~/STT-API-Server
git checkout main
```

### Using Dockge UI

Alternatively, updates can be triggered from the Dockge web interface:

1. Open Dockge web UI
2. Navigate to the "stt-service" stack
3. Click "Rebuild" or "Update"
4. Wait for the build to complete

**Note:** Dockge's "Update" may not always rebuild the image. Use command line with `--no-cache` flag for guaranteed rebuild.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/transcribe` | POST | Native transcription (returns language info) |
| `/transcribe-blob` | POST | Transcribe recorded audio blob |
| `/v1/audio/transcriptions` | POST | OpenAI-compatible endpoint (for CAAL) |
| `/user/{code}` | GET | User-specific web interface |
| `/user/{code}/transcribe-and-save` | POST | Transcribe and save to user folder |
| `/user/{code}/browse-folders` | GET | List user's folders |
| `/user/{code}/saved-notes` | GET | List user's saved notes |

### Testing Endpoints

```bash
# Health check
curl http://10.30.11.45:8060/health

# Native transcription
curl -X POST "http://10.30.11.45:8060/transcribe" \
     -F audio=@test.wav

# OpenAI-compatible endpoint (used by CAAL)
curl -X POST "http://10.30.11.45:8060/v1/audio/transcriptions" \
     -F file=@test.wav \
     -F model=whisper-1
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker logs stt-api-container-name

# Check if GPU is accessible
docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu22.04 nvidia-smi
```

### Changes Not Appearing After Update

Ensure you're rebuilding with `--no-cache`:

```bash
docker compose build --no-cache stt-api
docker compose up -d stt-api
```

### Wrong Branch Deployed

Verify the branch in the source directory:

```bash
cd ~/STT-API-Server
git branch --show-current
```

### Check Container Is Using Latest Code

```bash
# Check when the image was built
docker images | grep stt

# Force rebuild if needed
docker compose build --no-cache stt-api
```

---

## Rollback

To rollback to a previous version:

```bash
# 1. Checkout the previous commit or tag
cd ~/STT-API-Server
git log --oneline  # Find the commit you want
git checkout <commit-hash>

# 2. Rebuild and restart
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose build --no-cache stt-api
docker compose up -d stt-api

# 3. When done testing, return to main
cd ~/STT-API-Server
git checkout main
```

---

## Files Reference

| File | Location | Purpose |
|------|----------|---------|
| `main-ui.py` | Source root | Main application with web UI |
| `Dockerfile` | Source root | Container build instructions |
| `requirements.txt` | Source root | Python dependencies |
| `compose.yaml` | Dockge stack | Deployment configuration |
| `templates/index.html` | Source root | Web UI template |
| `users.txt` | `/app/vnotes/` | User code mapping |
