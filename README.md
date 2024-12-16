# Speech-to-Text API Server

A simple REST API server that provides speech-to-text functionality using Faster Whisper, with support for file uploads and microphone recording.

## Installation Options

You can install and run the server either locally or using Docker. Choose the method that best suits your needs.

### Local Installation

#### Requirements
- Python 3.12
- NVIDIA GPU with CUDA support (optional, will fall back to CPU)
- ~4GB disk space for models
- FFmpeg for audio processing

#### Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd STT-API-Server
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Linux/Mac
# or
.\venv\Scripts\activate  # On Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create required directories:
```bash
mkdir -p output uploads
```

5. Generate SSL certificates (required for microphone access):
```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 365 -subj '/CN=localhost'
```

### Docker Installation

#### Requirements
- Docker 24.0 or later
- NVIDIA GPU with CUDA 12.6 support (optional)
- NVIDIA Container Toolkit (nvidia-docker2) for GPU support
- ~5GB disk space for Docker image
- ~4GB additional space for model cache

#### Steps

1. Install NVIDIA Container Toolkit (if using GPU):
```bash
# Ubuntu/Debian
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

2. Clone the repository:
```bash
git clone <repository-url>
cd STT-API-Server
```

3. Make the build script executable:
```bash
chmod +x docker-build.sh
```

4. Build the Docker image:
```bash
./docker-build.sh
```
This will:
- Install all dependencies
- Configure GPU support with CPU fallback
- Generate SSL certificates
- Set up health monitoring

5. Create local directories for persistence:
```bash
mkdir -p output uploads
```

## Running the Server

### Local Running

The server runs over HTTPS using self-signed certificates for security (required for microphone access). After completing the local installation:

1. API-only version (recommended for production):
```bash
# Activate virtual environment if not already active
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows

# Run API server
python main.py
```

2. Version with web interface (recommended for testing):
```bash
# Activate virtual environment if not already active
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows

# Run web interface server
python main-ui.py
```

Both versions will run on https://localhost:8000. When accessing the server:
- Your browser will show a security warning because of the self-signed certificate
- Click "Advanced" and "Proceed to localhost" to access the interface
- The web interface provides a user-friendly interface for testing the STT functionality
- The API-only version is more suitable for production deployments where only the REST API is needed

Note: HTTPS is required for security-sensitive features like microphone access in modern browsers.

### Docker Running

After completing the Docker installation, you can run the server using either method:

1. Using docker-compose (recommended):
```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

2. Using docker command:
```bash
# Start the server
docker run -d --name stt-server \
  --gpus all \
  -p 8000:8000 \
  -v ./output:/app/output \
  -v ./uploads:/app/uploads \
  stt-server:latest

# View logs
docker logs -f stt-server

# Stop the server
docker stop stt-server
docker rm stt-server
```

### Verifying Installation

After starting the server, verify it's working:

1. Check the health endpoint:
```bash
curl --insecure https://localhost:8000/health
```

2. Test transcription with a sample audio file:
```bash
curl --insecure -X POST "https://localhost:8000/transcribe" \
     -F "audio=@sample.wav" \
     --output result.json
```

3. Open web interface (if using main-ui.py):
   Visit https://localhost:8000 in your browser
   - You'll see a security warning due to the self-signed certificate
   - Click "Advanced" and "Proceed to localhost" to access the interface

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- Swagger UI: https://localhost:8000/docs
- ReDoc: https://localhost:8000/redoc

Note: When accessing the API documentation or making API calls:
- For development with self-signed certificates, use the `--insecure` flag with curl or disable certificate verification in your client
- For production, use properly signed SSL certificates from a trusted Certificate Authority

## Features

- Speech-to-text conversion using Faster Whisper
- Support for multiple audio formats
- Microphone recording capability
- Language detection
- Confidence scores
- Comprehensive error handling
- Detailed logging
- CORS support for web applications
- Automatic temporary file cleanup
- Health check endpoint for monitoring

## Performance

- First-time startup will download required models (about 4GB)
- Transcription speed depends on audio length and hardware
- GPU acceleration provides significant performance improvement
- Processing time is included in response headers as 'X-Process-Time'

## Error Handling

The API handles various error cases:
- 400: Invalid input (unsupported format, file too large)
- 500: Internal server error
- 503: Model not initialized

## Troubleshooting

### Common Installation Issues

1. CUDA/GPU Issues:
   - Error: "CUDA not available"
   - Solution: The server will fall back to CPU. For GPU support, ensure NVIDIA drivers and CUDA 12.6 are installed.

2. Docker GPU Access:
   - Error: "GPU unavailable in container"
   - Solution: Ensure nvidia-container-toolkit is installed and docker service was restarted

3. Memory Issues:
   - Error: "CUDA out of memory"
   - Solution: Reduce batch size or use CPU mode if GPU memory is insufficient

4. SSL Certificate Issues:
   - Error: "Unable to access microphone"
   - Solution: Ensure HTTPS is used and SSL certificates are properly generated

### Common Runtime Issues

1. Port Conflicts:
   - Error: "Address already in use"
   - Solution: Stop other services using port 8000 or change the port:
     ```bash
     # Local
     PORT=8001 python main.py
     
     # Docker
     docker run -p 8001:8000 ...
     ```

2. Permission Issues:
   - Error: "Permission denied" for output/uploads
   - Solution: Ensure directories have correct permissions:
     ```bash
     chmod 777 output uploads
     ```

3. Disk Space:
   - Error: "No space left on device"
   - Solution: Clear old output files or model cache:
     ```bash
     rm -rf output/*
     rm -rf ~/.cache/huggingface/hub
     ```

## Notes

- The server uses the Faster Whisper Large-v3 model (latest version)
- Supports multiple audio formats through FFmpeg
- Temporary files are automatically cleaned up after each request
- All API endpoints support CORS for web integration
- Models are cached for faster subsequent starts