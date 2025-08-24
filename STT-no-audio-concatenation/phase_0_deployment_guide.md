# Phase 0 Fix: Complete Deployment Guide

## Overview
This guide will deploy the fixed prototype system that removes FFmpeg/pydub dependencies and implements individual chunk transcription through Whisper.

## Files to Replace (5 Total)

### 1. requirements.txt
- **Location**: `STT-API-Server/requirements.txt`
- **Change**: Removed `pydub` dependency
- **Source**: Artifact `phase_0_fix_requirements`

### 2. main-ui.py  
- **Location**: `STT-API-Server/main-ui.py`
- **Changes**: 
  - Removed `/prototype/concatenate` endpoint
  - Removed `pydub` import
  - Added `/prototype/transcribe-chunk` endpoint
  - Added `/prototype/assemble-session` endpoint
- **Source**: Artifact `phase_0_fix_main_ui`

### 3. templates/index.html
- **Location**: `STT-API-Server/templates/index.html`
- **Changes**:
  - Removed "Test Concatenation" button
  - Added "Transcribe Chunks" button
  - Added "Assemble Text" button
- **Source**: Artifact `phase_0_fix_index_html`

### 4. templates/static/js/app.js
- **Location**: `STT-API-Server/templates/static/js/app.js`
- **Changes**:
  - Added `transcribeAllChunks()` method
  - Added `assembleSessionText()` method
  - Updated event listeners for new buttons
- **Source**: Artifact `phase_0_fix_app_js`

### 5. templates/static/js/recording.js
- **Location**: `STT-API-Server/templates/static/js/recording.js`
- **Changes**:
  - Removed `testConcatenation()` method
  - Kept all checkpoint functionality
- **Source**: Artifact `phase_0_fix_recording_js`

## Deployment Steps

### Step 1: Backup Current Files (Recommended)
```bash
# Navigate to your STT-API-Server directory
cd /path/to/STT-API-Server

# Create backup copies
cp requirements.txt requirements.txt.backup
cp main-ui.py main-ui.py.backup
cp templates/index.html templates/index.html.backup
cp templates/static/js/app.js templates/static/js/app.js.backup
cp templates/static/js/recording.js templates/static/js/recording.js.backup
```

### Step 2: Replace Files with Artifact Content
**For each file:**
1. Open the file in your text editor
2. Select all content (Ctrl+A)
3. Replace with the complete content from the corresponding artifact
4. Save the file

**Files to replace:**
- `requirements.txt` → Content from `phase_0_fix_requirements`
- `main-ui.py` → Content from `phase_0_fix_main_ui`
- `templates/index.html` → Content from `phase_0_fix_index_html`
- `templates/static/js/app.js` → Content from `phase_0_fix_app_js`
- `templates/static/js/recording.js` → Content from `phase_0_fix_recording_js`

### Step 3: Commit Changes to Git
```bash
# In your STT-API-Server directory
git add .
git commit -m "Phase 0 Fix: Remove FFmpeg deps, add individual chunk transcription"
git push origin main
```

### Step 4: Deploy to Server
```bash
# SSH to your server
ssh agnes@your-server-ip

# Navigate to STT source and pull changes
cd ~/STT-API-Server
git pull origin main

# Navigate to deployment directory
cd ~/ai-toolbox-container-deployment/stacks/stt-service

# Stop current container
docker compose down

# Rebuild with new code (this will install dependencies from new requirements.txt)
docker compose up -d --build
```

### Step 5: Verify Deployment
```bash
# Check container is running
docker ps | grep stt

# Check container logs for successful startup
docker logs stt-service-stt-api-1

# Look for these success messages:
# - "Faster Whisper model initialized successfully"
# - No pydub or FFmpeg errors
# - Server listening on port 8000

# Test prototype endpoints
curl --insecure https://localhost:8060/prototype/sessions
# Should return: {"sessions": []}
```

### Step 6: Test Fixed Prototype
1. **Access Interface**:
   - Open browser to: `https://100.82.13.191:8060/user/YOUR_USER_CODE`
   - Look for "🧪 PROTOTYPE MODE (FIXED)" section

2. **Test New Flow**:
   - Click **"Enable Prototype Mode"**
   - Click **"Start 60s Test Recording"** → Speak for 60 seconds
   - Click **"Transcribe Chunks"** → Watch Whisper process each chunk
   - Click **"Assemble Text"** → See final transcription appear

3. **Expected Results**:
   ```
   Prototype mode enabled
   Saved checkpoint 0
   Saved checkpoint 1  
   Saved checkpoint 2
   60-second test recording completed
   
   Transcribing chunk 1 of 3...
   Transcribing chunk 2 of 3...
   Transcribing chunk 3 of 3...
   Transcription complete: 3 success, 0 failed
   
   ✅ SUCCESS: Combined 3 chunks
   Final transcription displayed above
   ```

## Success Criteria

### ✅ Deployment Successful If:
- Container starts without FFmpeg/pydub errors
- Prototype section shows "PROTOTYPE MODE (FIXED)"
- All 4 buttons are present: Enable, Start Recording, Transcribe Chunks, Assemble Text
- No "Test Concatenation" button visible

### ✅ Functionality Working If:
- 20-second chunks save during recording
- Individual chunk transcription succeeds
- Final text assembly produces readable transcription
- No audio concatenation errors

### ✅ iPhone Test (Optional):
- Prototype works on iPhone Safari via Netbird
- Same functionality as desktop
- No mobile-specific errors

## Rollback Plan (If Issues Occur)

```bash
# On server, restore backup files
cd ~/STT-API-Server
cp requirements.txt.backup requirements.txt
cp main-ui.py.backup main-ui.py
cp templates/index.html.backup templates/index.html
cp templates/static/js/app.js.backup templates/static/js/app.js
cp templates/static/js/recording.js.backup templates/static/js/recording.js

# Rebuild with original code
cd ~/ai-toolbox-container-deployment/stacks/stt-service
docker compose down
docker compose up -d --build
```

## Troubleshooting

### Common Issues:

**1. Container Won't Start**
```bash
# Check logs for errors
docker logs stt-service-stt-api-1

# Look for Python import errors or syntax errors
```

**2. Prototype Section Missing**
- Verify `templates/index.html` was updated correctly
- Check browser console for JavaScript errors (F12)

**3. Transcribe Chunks Fails**
```bash
# Check if Whisper model loaded successfully
docker logs stt-service-stt-api-1 | grep "Whisper model initialized"
```

**4. Endpoints Not Found**
```bash
# Verify new endpoints exist
curl --insecure https://localhost:8060/prototype/sessions
# Should return JSON, not 404 error
```

## What This Deployment Achieves

### ✅ Problems Fixed:
- Removed FFmpeg/pydub dependency issues
- Eliminated audio concatenation complexity
- Simplified container dependencies

### ✅ New Capabilities:
- Individual chunk transcription using existing Whisper setup
- Text-level assembly (no audio processing)
- Validates production chunked recording architecture

### ✅ Validates:
- 20-second chunks work reliably
- Whisper handles short audio segments well
- Text assembly produces coherent results
- iPhone Safari compatibility with chunking

## Next Steps After Successful Test

If the prototype works successfully:
1. **Document chunk transcription quality** - How good are the individual results?
2. **Measure iPhone performance** - Battery/memory impact of 20-second uploads
3. **Plan Phase 1** - Move from prototype to production chunked recording
4. **Design LLM integration** - How to clean up and enhance assembled text

---

**Ready to deploy? Follow steps 1-6 above and report results.**