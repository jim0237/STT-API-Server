from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Form
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import tempfile
import os
import logging
import torch
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field
import shutil
from datetime import datetime
from typing import List
from pydub import AudioSegment  # ADD for prototype

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

# Base directory for voice notes
VNOTES_DIR = "/app/vnotes"

# ADD: Prototype checkpoint directory
CHECKPOINT_DIR = "/tmp/voice_notes_checkpoints"
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

app = FastAPI(title="Speech-to-Text Web Interface")

# Mount static files for modular frontend
app.mount("/static", StaticFiles(directory="templates/static"), name="static")

# Initialize templates
templates = Jinja2Templates(directory="templates")

# Initialize Whisper model
model = None

# USER MANAGEMENT FUNCTIONS
def load_user_mapping():
    """Load user code to directory mapping from file"""
    users_file = os.path.join(VNOTES_DIR, "users.txt")
    user_mapping = {}
    
    if os.path.exists(users_file):
        try:
            with open(users_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and '=' in line:
                        code, directory = line.split('=', 1)
                        user_mapping[code.strip()] = directory.strip()
            logger.info(f"Loaded {len(user_mapping)} users from mapping file")
        except Exception as e:
            logger.error(f"Error loading user mapping: {str(e)}")
    else:
        logger.warning(f"User mapping file not found: {users_file}")
    
    return user_mapping

def get_user_directory(user_code: str) -> str:
    """Get the directory path for a user code"""
    user_mapping = load_user_mapping()
    
    if user_code not in user_mapping:
        raise HTTPException(status_code=404, detail=f"User code '{user_code}' not found")
    
    user_dir = os.path.join(VNOTES_DIR, "users", user_mapping[user_code])
    
    # Ensure user directory and subdirectories exist
    base_folders = ["daily_notes", "meeting_notes", "ideas", "research"]
    for folder in base_folders:
        folder_path = os.path.join(user_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
    
    logger.info(f"User {user_code} mapped to directory: {user_dir}")
    return user_dir

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
        
        # Create voice notes folder structure
        await create_vnotes_structure()
        
    except Exception as e:
        logger.error(f"Failed to initialize Whisper model: {str(e)}")
        raise RuntimeError("Failed to initialize STT model")

async def create_vnotes_structure():
    """Create base folder structure for voice notes"""
    # Create main directories
    os.makedirs(VNOTES_DIR, exist_ok=True)
    os.makedirs(os.path.join(VNOTES_DIR, "users"), exist_ok=True)
    
    # Create users.txt file if it doesn't exist
    users_file = os.path.join(VNOTES_DIR, "users.txt")
    if not os.path.exists(users_file):
        with open(users_file, 'w') as f:
            f.write("# User code mapping file\n")
            f.write("# Format: USERCODE=directory-name\n")
            f.write("# Example: VFRDZ3=jbeasley-VFRDZ3\n")
        logger.info(f"Created user mapping file: {users_file}")
    
    logger.info(f"Voice notes directory structure created at {VNOTES_DIR}")

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

# ORIGINAL ROUTES (Keep for backward compatibility during transition)
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Render the web interface - redirect to user selection or admin"""
    return HTMLResponse("""
    <html>
    <head><title>Voice Notes</title></head>
    <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
        <h1>🎤 Voice Notes</h1>
        <p>Please use your personal user URL:</p>
        <p><code>https://100.82.13.191:8060/user/YOUR_CODE</code></p>
        <p><em>Contact administrator for your user code.</em></p>
    </body>
    </html>
    """)

# NEW USER-SPECIFIC ROUTES
@app.get("/user/{user_code}", response_class=HTMLResponse)
async def user_home(request: Request, user_code: str):
    """Render the web interface for a specific user"""
    try:
        # Validate user exists
        get_user_directory(user_code)
        
        # Render template with user context
        return templates.TemplateResponse(
            "index.html",
            {"request": request, "user_code": user_code}
        )
    except HTTPException:
        return HTMLResponse(f"""
        <html>
        <head><title>User Not Found</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1>⚠ User Not Found</h1>
            <p>User code '<strong>{user_code}</strong>' is not valid.</p>
            <p>Please check your URL or contact your administrator.</p>
        </body>
        </html>
        """, status_code=404)

@app.get("/user/{user_code}/browse-folders")
async def user_browse_folders(user_code: str):
    """Get available folders for a specific user"""
    try:
        user_dir = get_user_directory(user_code)
        
        # Return consistent folder structure
        folders = [
            {
                "name": "Daily Notes",
                "value": "daily_notes",
                "path": os.path.join(user_dir, "daily_notes")
            },
            {
                "name": "Meeting Notes", 
                "value": "meeting_notes",
                "path": os.path.join(user_dir, "meeting_notes")
            },
            {
                "name": "Ideas",
                "value": "ideas", 
                "path": os.path.join(user_dir, "ideas")
            },
            {
                "name": "Research",
                "value": "research",
                "path": os.path.join(user_dir, "research")
            }
        ]
        
        # Ensure all folders exist
        for folder in folders:
            os.makedirs(folder["path"], exist_ok=True)
        
        logger.info(f"User {user_code} - Available folders: {[f['value'] for f in folders]}")
        return {"folders": folders}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error browsing folders for user {user_code}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/user/{user_code}/transcribe-and-save")
async def user_transcribe_and_save(
    user_code: str,
    audio: UploadFile = File(...),
    folder: str = Form("daily_notes")
):
    """Transcribe audio and save to user's specific directory"""
    try:
        # Get user directory
        user_dir = get_user_directory(user_code)
        
        # Add logging to debug folder parameter
        logger.info(f"User {user_code} - Received transcription request for folder: '{folder}'")
        
        # Validate folder parameter
        valid_folders = ["daily_notes", "meeting_notes", "ideas", "research"]
        if folder not in valid_folders:
            logger.warning(f"User {user_code} - Invalid folder '{folder}', using 'daily_notes' instead")
            folder = "daily_notes"
        
        # Generate timestamp for filenames
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        
        # Determine file extension
        audio_extension = os.path.splitext(audio.filename)[1] or ".wav"
        
        # Create target folder path within user directory
        target_folder = os.path.join(user_dir, folder)
        os.makedirs(target_folder, exist_ok=True)
        logger.info(f"User {user_code} - Saving to target folder: {target_folder}")
        
        # Save audio file temporarily for transcription
        temp_audio_path = os.path.join(UPLOAD_DIR, f"{user_code}_{audio.filename}")
        with open(temp_audio_path, "wb") as f:
            content = await audio.read()
            f.write(content)

        # Transcribe audio
        logger.info(f"User {user_code} - Transcribing and saving audio: {audio.filename}")
        segments, info = model.transcribe(
            temp_audio_path,
            beam_size=5,
            word_timestamps=True
        )
        
        transcription = " ".join([segment.text for segment in segments])
        
        # Save audio file to target folder
        audio_filename = f"{timestamp}{audio_extension}"
        audio_save_path = os.path.join(target_folder, audio_filename)
        shutil.copy2(temp_audio_path, audio_save_path)
        logger.info(f"User {user_code} - Audio saved to: {audio_save_path}")
        
        # Save transcription file
        text_filename = f"{timestamp}.txt"
        text_save_path = os.path.join(target_folder, text_filename)
        with open(text_save_path, "w", encoding="utf-8") as f:
            f.write(transcription)
        logger.info(f"User {user_code} - Transcription saved to: {text_save_path}")
        
        # Cleanup temp file
        os.unlink(temp_audio_path)
        
        # Return result with user context
        return {
            "text": transcription,
            "language": info.language,
            "language_probability": info.language_probability,
            "folder_used": folder,
            "user_code": user_code,
            "saved_files": {
                "audio": audio_save_path,
                "transcription": text_save_path
            },
            "timestamp": timestamp
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"User {user_code} - Error in transcribe and save: {str(e)}")
        if 'temp_audio_path' in locals() and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/{user_code}/saved-notes")
async def user_get_saved_notes(user_code: str, folder: str = None):
    """Get list of saved notes for a specific user"""
    try:
        user_dir = get_user_directory(user_code)
        notes = []
        
        if folder:
            # Get notes from specific folder
            folder_path = os.path.join(user_dir, folder)
            if os.path.exists(folder_path):
                notes.extend(_get_notes_from_folder(folder_path, folder))
        else:
            # Get notes from all user's folders
            base_folders = ["daily_notes", "meeting_notes", "ideas", "research"]
            for folder_name in base_folders:
                folder_path = os.path.join(user_dir, folder_name)
                if os.path.exists(folder_path):
                    notes.extend(_get_notes_from_folder(folder_path, folder_name))
        
        # Sort by timestamp (newest first)
        notes.sort(key=lambda x: x["timestamp"], reverse=True)
        
        logger.info(f"User {user_code} - Retrieved {len(notes)} saved notes")
        return {"notes": notes, "user_code": user_code}
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"User {user_code} - Error getting saved notes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# LEGACY ROUTES (Keep for backward compatibility)
@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Legacy transcribe endpoint - transcribe only, no saving"""
    try:
        # Save uploaded file
        audio_path = os.path.join(UPLOAD_DIR, audio.filename)
        
        with open(audio_path, "wb") as f:
            content = await audio.read()
            f.write(content)

        # Transcribe audio
        logger.info(f"Legacy transcribe - Transcribing audio file: {audio.filename}")
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
    """Legacy transcribe blob endpoint"""
    try:
        # Save uploaded blob
        audio_path = os.path.join(UPLOAD_DIR, "recorded_audio.wav")
        
        with open(audio_path, "wb") as f:
            content = await audio.read()
            f.write(content)

        # Transcribe audio
        logger.info("Legacy transcribe blob - Transcribing recorded audio")
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

def _get_notes_from_folder(folder_path: str, folder_name: str) -> List[dict]:
    """Helper function to get notes from a specific folder"""
    notes = []
    
    try:
        for file in os.listdir(folder_path):
            if file.endswith('.txt'):
                # Extract timestamp from filename
                timestamp_str = file.replace('.txt', '')
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d_%H-%M-%S")
                except ValueError:
                    continue  # Skip files that don't match timestamp format
                
                file_path = os.path.join(folder_path, file)
                
                # Read transcription content
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                except:
                    content = "Error reading file"
                
                # Check for corresponding audio file
                audio_extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.webm']
                audio_file = None
                for ext in audio_extensions:
                    potential_audio = os.path.join(folder_path, f"{timestamp_str}{ext}")
                    if os.path.exists(potential_audio):
                        audio_file = f"{timestamp_str}{ext}"
                        break
                
                notes.append({
                    "timestamp": timestamp.isoformat(),
                    "folder": folder_name,
                    "folder_display": folder_name.replace("_", " ").title(),
                    "transcription_file": file,
                    "audio_file": audio_file,
                    "content_preview": content[:100] + "..." if len(content) > 100 else content,
                    "full_content": content,
                    "language_probability": 0.95  # Default since we don't store this separately
                })
    
    except Exception as e:
        logger.error(f"Error reading folder {folder_path}: {str(e)}")
    
    return notes

# ADD: PROTOTYPE ENDPOINTS
@app.post("/prototype/checkpoint")
async def save_checkpoint_prototype(
    session_id: str = Form(...),
    chunk_number: int = Form(...),
    audio: UploadFile = File(...)
):
    """
    Prototype checkpoint endpoint - saves audio chunks for testing
    """
    try:
        # Create session directory if not exists
        session_dir = os.path.join(CHECKPOINT_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        # Save chunk with sequence number
        chunk_filename = f"chunk_{chunk_number:03d}_{audio.filename}"
        chunk_path = os.path.join(session_dir, chunk_filename)
        
        # Save uploaded audio chunk
        with open(chunk_path, "wb") as f:
            content = await audio.read()
            f.write(content)
        
        # Log for debugging
        logger.info(f"Saved checkpoint: {chunk_path} ({len(content)} bytes)")
        
        return {
            "status": "saved",
            "chunk_id": f"{session_id}_{chunk_number}",
            "file_path": chunk_path,
            "size_bytes": len(content),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Checkpoint save failed: {str(e)}")
        return {"status": "failed", "error": str(e)}

@app.post("/prototype/concatenate")
async def concatenate_chunks_prototype(session_id: str = Form(...)):
    """
    Prototype concatenation endpoint - combines chunks for testing
    """
    try:
        session_dir = os.path.join(CHECKPOINT_DIR, session_id)
        
        if not os.path.exists(session_dir):
            raise Exception(f"Session directory not found: {session_id}")
        
        # Find all chunk files
        chunk_files = []
        for file in os.listdir(session_dir):
            if file.startswith("chunk_"):
                chunk_files.append(os.path.join(session_dir, file))
        
        if not chunk_files:
            raise Exception("No chunks found")
        
        # Sort by chunk number
        chunk_files.sort()
        
        # Concatenate using pydub
        combined = AudioSegment.empty()
        for chunk_file in chunk_files:
            chunk_audio = AudioSegment.from_file(chunk_file)
            combined += chunk_audio
        
        # Save concatenated result
        output_path = os.path.join(session_dir, "concatenated.wav")
        combined.export(output_path, format="wav")
        
        logger.info(f"Concatenated {len(chunk_files)} chunks to {output_path}")
        
        return {
            "status": "success",
            "output_file": output_path,
            "chunk_count": len(chunk_files),
            "duration_ms": len(combined),
            "file_size": os.path.getsize(output_path)
        }
        
    except Exception as e:
        logger.error(f"Concatenation failed: {str(e)}")
        return {"status": "failed", "error": str(e)}

@app.get("/prototype/sessions")
async def list_checkpoint_sessions():
    """List all prototype checkpoint sessions for debugging"""
    try:
        sessions = []
        if os.path.exists(CHECKPOINT_DIR):
            for session_id in os.listdir(CHECKPOINT_DIR):
                session_path = os.path.join(CHECKPOINT_DIR, session_id)
                if os.path.isdir(session_path):
                    chunk_count = len([f for f in os.listdir(session_path) 
                                     if f.startswith("chunk_")])
                    sessions.append({
                        "session_id": session_id,
                        "chunk_count": chunk_count,
                        "created": datetime.fromtimestamp(os.path.getctime(session_path)).isoformat()
                    })
        
        return {"sessions": sessions}
    except Exception as e:
        return {"error": str(e)}

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

    # Add user count to health check
    user_mapping = load_user_mapping()
    
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "memory_info": memory_info,
        "user_count": len(user_mapping),
        "users": list(user_mapping.keys()) if user_mapping else []
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