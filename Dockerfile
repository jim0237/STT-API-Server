# Use NVIDIA CUDA base image for minimal size
FROM nvidia/cuda:12.6.3-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

# Install system dependencies and Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    openssl \
    curl \
    wget \
    && wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb \
    && dpkg -i cuda-keyring_1.1-1_all.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    libcudnn9-cuda-12 \
    && rm -rf cuda-keyring_1.1-1_all.deb \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/output /app/uploads /app/templates

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Generate SSL certificates
RUN openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout key.pem -out cert.pem -days 365 \
    -subj '/CN=localhost'

# Copy application files
#COPY main.py main-ui.py ./
COPY main-ui.py ./
COPY templates templates/

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main-ui.py"]