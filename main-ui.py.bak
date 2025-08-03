from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
import tempfile
import os
import logging
import torch
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create output directory
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Create temp directory for uploaded files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Speech-to-Text Web Interface")

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Initialize Whisper model
model = None

@app.on_event("startup")
async def startup_event():
    """Initialize the Whisper model on startup"""
    global model
    try:
        logger.info("Initializing Faster Whisper model...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if torch.cuda.is_available() else "float32"
        
        model = WhisperModel(
            model_size_or_path="large-v3",
            device=device,
            compute_type=compute_type,
            download_root=os.path.join(os.path.dirname(__file__), "models")
        )
        
        logger.info(f"Faster Whisper model initialized successfully on {device}")
    except Exception as e:
        logger.error(f"Failed to initialize Whisper model: {str(e)}")
        raise RuntimeError("Failed to initialize STT model")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup output and upload files on shutdown"""
    try:
        shutil.rmtree(OUTPUT_DIR)
        shutil.rmtree(UPLOAD_DIR)
        os.makedirs(OUTPUT_DIR)
        os.makedirs(UPLOAD_DIR)
        logger.info("Output and upload files cleaned up")
    except Exception as e:
        logger.error(f"Error cleaning up files: {str(e)}")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Render the web interface"""
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio file using Faster Whisper
    """
    try:
        # Save uploaded file
        audio_path = os.path.join(UPLOAD_DIR, audio.filename)
        
        with open(audio_path, "wb") as f:
            content = await audio.read()
            f.write(content)

        # Transcribe audio
        logger.info(f"Transcribing audio file: {audio.filename}")
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True
        )
        
        # Format results
        transcription = " ".join([segment.text for segment in segments])
        
        # Cleanup
        os.unlink(audio_path)
        
        return {
            "text": transcription,
            "language": info.language,
            "language_probability": info.language_probability
        }
    
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        if 'audio_path' in locals() and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup file after error: {str(cleanup_error)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe-blob")
async def transcribe_blob(audio: UploadFile = File(...)):
    """
    Transcribe audio blob from microphone recording
    """
    try:
        # Save uploaded blob
        audio_path = os.path.join(UPLOAD_DIR, "recorded_audio.wav")
        
        with open(audio_path, "wb") as f:
            content = await audio.read()
            f.write(content)

        # Transcribe audio
        logger.info("Transcribing recorded audio")
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True
        )
        
        # Format results
        transcription = " ".join([segment.text for segment in segments])
        
        # Cleanup
        os.unlink(audio_path)
        
        return {
            "text": transcription,
            "language": info.language,
            "language_probability": info.language_probability
        }
    
    except Exception as e:
        logger.error(f"Error transcribing recorded audio: {str(e)}")
        if 'audio_path' in locals() and os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup file after error: {str(cleanup_error)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if torch.cuda.is_available():
        total_memory = torch.cuda.get_device_properties(0).total_memory
        free_memory = torch.cuda.memory_reserved(0) - torch.cuda.memory_allocated(0)
        memory_info = {
            "total_gpu_memory": f"{total_memory / (1024**3):.2f} GB",
            "free_gpu_memory": f"{free_memory / (1024**3):.2f} GB",
            "gpu_utilization": f"{(1 - free_memory/total_memory) * 100:.1f}%"
        }
    else:
        memory_info = {"gpu_status": "No GPU available"}

    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "memory_info": memory_info
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem"
    )