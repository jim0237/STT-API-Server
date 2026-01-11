# OpenAI-Compatible Endpoint Implementation Plan

## Overview

Add `/v1/audio/transcriptions` endpoint to enable CAAL virtual assistant integration without breaking existing functionality.

**Change Summary:**
- 1 file to modify: `main-ui.py`
- ~40 lines of code to add
- No existing code changes
- Zero risk to current functionality

---

## Implementation Checklist

### Phase 1: Setup Feature Branch

- [ ] **Create feature branch**
  ```bash
  git checkout -b feature/add-openai-transcriptions-endpoint
  ```

- [ ] **Verify branch created**
  ```bash
  git branch --show-current
  # Should show: feature/add-openai-transcriptions-endpoint
  ```

### Phase 2: Code Modification

- [ ] **Open main-ui.py for editing**
  - File location: `main-ui.py`
  - Insert location: After `/transcribe-blob` endpoint (around line 431)

- [ ] **Add the new endpoint**

  Insert the following code after the `/transcribe-blob` endpoint:

  ```python
  @app.post("/v1/audio/transcriptions")
  async def openai_transcribe(
      file: UploadFile = File(...),
      model: str = Form(...)
  ):
      """
      OpenAI Whisper API-compatible transcription endpoint.
      Expected by CAAL virtual assistant and other OpenAI-compatible clients.

      Parameters:
      - file: Audio file to transcribe (multipart/form-data)
      - model: Model name (currently ignored, always uses whisper large-v3)

      Returns:
      - JSON response in OpenAI format: {"text": "transcribed text"}
      """
      try:
          # Save uploaded file temporarily
          temp_path = os.path.join(UPLOAD_DIR, file.filename)

          with open(temp_path, "wb") as f:
              content = await file.read()
              f.write(content)

          # Transcribe using Whisper model
          logger.info(f"OpenAI-compatible endpoint - Transcribing: {file.filename} (model param: {model})")
          segments, info = model.transcribe(
              temp_path,
              beam_size=5,
              word_timestamps=True
          )

          # Format as OpenAI response (simple format)
          transcription = " ".join([segment.text for segment in segments])

          # Cleanup temp file
          os.unlink(temp_path)

          # Return OpenAI-compatible response format
          return {"text": transcription}

      except Exception as e:
          logger.error(f"OpenAI endpoint transcription error: {str(e)}")
          if 'temp_path' in locals() and os.path.exists(temp_path):
              try:
                  os.unlink(temp_path)
              except:
                  pass
          raise HTTPException(status_code=500, detail=str(e))
  ```

- [ ] **Save the file**

- [ ] **Commit the change**
  ```bash
  git add main-ui.py
  git commit -m "Add OpenAI-compatible /v1/audio/transcriptions endpoint for CAAL integration"
  ```

### Phase 3: Deploy to Server (10.30.11.45)

**Deployment Strategy:** Since the STT service runs on a remote server with GPU (10.30.11.45), we'll deploy the feature branch there for testing.

#### 3.1 SSH to Server and Pull Feature Branch

- [ ] **SSH to the server**
  ```bash
  ssh user@10.30.11.45
  ```

- [ ] **Navigate to STT-API-Server directory**
  ```bash
  cd /path/to/STT-API-Server
  # (The directory that Dockge uses: ../../../STT-API-Server from compose file)
  ```

- [ ] **Fetch latest branches from GitHub**
  ```bash
  git fetch origin
  ```

- [ ] **Checkout the feature branch**
  ```bash
  git checkout feature/add-openai-transcriptions-endpoint
  ```

- [ ] **Verify you're on the feature branch**
  ```bash
  git branch --show-current
  # Should show: feature/add-openai-transcriptions-endpoint
  ```

#### 3.2 Rebuild and Restart via Dockge

- [ ] **In Dockge UI, rebuild the stt-api container**
  - Open Dockge web interface
  - Find the stt-api stack
  - Click "Rebuild" or "Restart"
  - Wait for rebuild to complete (~1-2 minutes)

  **OR via command line:**
  ```bash
  cd /path/to/dockge/stack/directory
  docker-compose build stt-api
  docker-compose up -d stt-api
  ```

- [ ] **Check container is running**
  ```bash
  docker ps | grep stt-api
  # Should show container running
  ```

- [ ] **Check logs for successful startup**
  ```bash
  docker logs stt-api-container-name | tail -20
  # Should see "Whisper model initialized successfully"
  ```

#### 3.3 Endpoint Testing (From Dev Machine or Server)

- [ ] **Test new OpenAI-compatible endpoint**
  ```bash
  # From dev machine (or from server locally)
  curl --insecure -X POST "https://10.30.11.45:8060/v1/audio/transcriptions" \
       -F file=@path/to/test-audio.wav \
       -F model=whisper-1
  ```

  **Expected result:**
  ```json
  {
    "text": "Transcribed text from the audio file"
  }
  ```

- [ ] **Verify logs show new endpoint was called**
  ```bash
  # On server
  docker logs stt-api-container-name | grep "OpenAI-compatible"
  # Should see: "OpenAI-compatible endpoint - Transcribing: test-audio.wav (model param: whisper-1)"
  ```

- [ ] **Test existing endpoints still work (regression test)**

  Test the legacy transcribe endpoint:
  ```bash
  curl --insecure -X POST "https://10.30.11.45:8060/transcribe" \
       -F audio=@path/to/test-audio.wav
  ```

  **Expected result:**
  ```json
  {
    "text": "Transcribed text...",
    "language": "en",
    "language_probability": 0.99
  }
  ```

- [ ] **Test web UI still works**
  - Open browser: `https://10.30.11.45:8060/`
  - Verify web interface loads
  - (Optional) Test recording/transcription through UI

#### 3.4 Health Check

- [ ] **Verify health endpoint**
  ```bash
  curl --insecure https://10.30.11.45:8060/health
  ```

  **Expected result:**
  ```json
  {
    "status": "healthy",
    "model_loaded": true,
    "device": "cuda"
  }
  ```

### Phase 4: Push Feature Branch

- [ ] **Push feature branch to GitHub**
  ```bash
  git push -u origin feature/add-openai-transcriptions-endpoint
  ```

- [ ] **Verify branch appears on GitHub**
  - Go to GitHub repository
  - Check branches list
  - Confirm feature branch is visible

### Phase 5: CAAL Integration Testing (Optional)

**Note:** This phase can be done after merging to main, but testing on feature branch first is safer.

- [ ] **Configure CAAL to use this STT service**

  In CAAL `.env` file:
  ```bash
  SPEACHES_URL=https://10.30.11.45:8060
  SSL_VERIFY=false
  ```

- [ ] **Restart CAAL agent**
  ```bash
  cd /path/to/caal
  docker compose restart agent
  ```

- [ ] **Test voice input through CAAL**
  - Open CAAL web UI
  - Click microphone button
  - Speak a test phrase
  - Verify transcription appears in CAAL

- [ ] **Check STT logs for CAAL requests**
  ```bash
  docker logs stt-server | grep "OpenAI-compatible"
  # Should see requests from CAAL
  ```

### Phase 6: Merge to Main

- [ ] **Review changes one final time**
  ```bash
  git diff main feature/add-openai-transcriptions-endpoint
  ```

- [ ] **Switch to main branch**
  ```bash
  git checkout main
  ```

- [ ] **Merge feature branch**
  ```bash
  git merge feature/add-openai-transcriptions-endpoint
  ```

- [ ] **Push to GitHub**
  ```bash
  git push origin main
  ```

- [ ] **Delete feature branch (optional cleanup)**
  ```bash
  # Local
  git branch -d feature/add-openai-transcriptions-endpoint

  # Remote
  git push origin --delete feature/add-openai-transcriptions-endpoint
  ```

---

## Rollback Plan

If anything goes wrong:

```bash
# Stop the service
docker-compose down

# Switch back to main branch
git checkout main

# Rebuild and restart
docker-compose build
docker-compose up -d
```

Your existing functionality will be completely unchanged.

---

## Success Criteria

- ✅ New `/v1/audio/transcriptions` endpoint responds with `{"text": "..."}` format
- ✅ Existing `/transcribe` endpoint still works as before
- ✅ Web UI still functions normally
- ✅ Health check returns healthy status
- ✅ Feature branch pushed to GitHub
- ✅ (Optional) CAAL can successfully transcribe voice input

---

## Notes

### Why This Won't Break Anything

1. **No existing code modified** - Only adding a new endpoint
2. **Reuses proven infrastructure** - Same Whisper model, same file handling
3. **Independent route** - Doesn't affect other endpoints
4. **Same error handling pattern** - Follows existing code style
5. **Feature branch workflow** - Easy to rollback if needed

### Port Configuration Reminder

If CAAL expects port 8060, update `docker-compose.yml`:

```yaml
services:
  stt-server:
    ports:
      - "8060:8000"  # External:Internal
```

Or update CAAL's `SPEACHES_URL` to use port 8000.

---

## Estimated Time

- Feature branch creation: 1 minute
- Code modification: 5 minutes
- Testing: 10 minutes
- Push and merge: 2 minutes
- **Total: ~20 minutes**
