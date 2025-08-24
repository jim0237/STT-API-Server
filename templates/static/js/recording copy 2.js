// Voice Notes Audio Recording Management
// templates/static/js/recording.js

const VoiceNotesRecording = {
    // Recording state
    mediaRecorder: null,
    recordedChunks: [],
    recordingInterval: null,
    startTime: null,
    isRecording: false,
    isInitialized: false,

    // ADD: Prototype properties
    prototypeMode: false,
    sessionId: null,
    chunkCounter: 0,
    checkpointResults: [],

    // Initialize microphone access
    async initialize() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: VoiceNotesConfig.audio.recording.sampleRate,
                    channelCount: VoiceNotesConfig.audio.recording.channelCount
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.getSupportedMimeType()
            });
            
            this.setupRecorderEvents();
            this.isInitialized = true;
            
            VoiceNotesUI.setProcessingState(false);
            VoiceNotesUI.showStatus('Microphone ready', 'success');
            
            return true;
        } catch (error) {
            console.error('Microphone setup failed:', error);
            this.handleMicrophoneError(error);
            return false;
        }
    },

    // Get supported MIME type for recording
    getSupportedMimeType() {
        const types = [
            'audio/webm',
            'audio/mp4',
            'audio/wav',
            'audio/ogg'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        
        // Fallback to default
        return 'audio/webm';
    },

    // Setup MediaRecorder event handlers (MODIFIED for prototype)
    setupRecorderEvents() {
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
                
                // ADD: Prototype checkpoint logic
                if (this.prototypeMode) {
                    await this.uploadCheckpoint(event.data, this.chunkCounter++);
                }
            }
        };

        this.mediaRecorder.onstop = () => {
            this.processRecording();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            this.handleRecordingError(event.error);
        };
    },

    // Handle microphone access errors
    handleMicrophoneError(error) {
        let message = 'Microphone access failed';
        
        if (error.name === 'NotAllowedError') {
            message = 'Microphone access denied. Please allow microphone access and refresh.';
        } else if (error.name === 'NotFoundError') {
            message = 'No microphone found. Please connect a microphone.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Audio recording not supported in this browser.';
        }
        
        VoiceNotesUI.elements.recordStatus.textContent = 'Microphone unavailable';
        VoiceNotesUI.showStatus(message, 'error');
    },

    // Handle recording errors
    handleRecordingError(error) {
        this.stopRecording();
        VoiceNotesUI.showStatus('Recording error: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
    },

    // Check if recording is possible
    canRecord() {
        return this.isInitialized && 
               this.mediaRecorder && 
               this.mediaRecorder.state === 'inactive' && 
               !this.isRecording;
    },

    // Toggle recording state
    async toggleRecording() {
        if (!this.isInitialized) {
            VoiceNotesUI.showStatus('Microphone not initialized', 'error');
            return false;
        }

        if (this.isRecording) {
            return this.stopRecording();
        } else {
            return this.startRecording();
        }
    },

    // Start recording
    startRecording() {
        if (!this.canRecord()) {
            VoiceNotesUI.showStatus('Cannot start recording', 'error');
            return false;
        }

        try {
            // Reset state
            this.recordedChunks = [];
            this.isRecording = true;
            this.startTime = Date.now();

            // Start MediaRecorder - MODIFIED for prototype
            const chunkInterval = this.prototypeMode ? 20000 : 10; // 20 seconds for prototype, 10ms for normal
            this.mediaRecorder.start(chunkInterval);
            
            // Update UI
            VoiceNotesUI.setRecordingState(true);
            VoiceNotesUI.showStatus('Recording started', 'success');
            
            // Start timer
            this.startTimer();
            
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.handleRecordingError(error);
            return false;
        }
    },

    // Stop recording
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            return false;
        }

        try {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Update UI
            VoiceNotesUI.setRecordingState(false);
            VoiceNotesUI.setProcessingState(true);
            VoiceNotesUI.showStatus('Processing recording...', 'success');
            
            // Stop timer
            this.stopTimer();
            
            return true;
        } catch (error) {
            console.error('Failed to stop recording:', error);
            this.handleRecordingError(error);
            return false;
        }
    },

    // Start recording timer
    startTimer() {
        this.recordingInterval = setInterval(() => {
            if (this.startTime) {
                const duration = Math.floor((Date.now() - this.startTime) / 1000);
                VoiceNotesUI.updateRecordingTimer(duration);
            }
        }, VoiceNotesConfig.ui.timers.recordingUpdate);
    },

    // Stop recording timer
    stopTimer() {
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
    },

    // Process recorded audio
    async processRecording() {
        try {
            if (this.recordedChunks.length === 0) {
                throw new Error('No audio data recorded');
            }

            const audioBlob = new Blob(this.recordedChunks, { 
                type: VoiceNotesConfig.audio.recording.mimeType 
            });
            
            if (audioBlob.size === 0) {
                throw new Error('Recorded audio is empty');
            }

            // Get selected folder from UI
            const selectedFolder = VoiceNotesUI.elements.folderSelect.value;
            
            // Send to API for transcription
            const result = await VoiceNotesAPI.processRecording(audioBlob, selectedFolder);
            
            // Display results
            VoiceNotesUI.displayTranscription(result);
            VoiceNotesUI.showStatus(`✅ Recording saved to ${result.folder_used || selectedFolder}`, 'success');
            
            // Refresh notes list
            await this.refreshNotesList();
            
        } catch (error) {
            console.error('Error processing recording:', error);
            VoiceNotesUI.showStatus('Error: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
        } finally {
            // Reset UI state
            VoiceNotesUI.setProcessingState(false);
            VoiceNotesUI.resetTimer();
            
            // Clear recorded data
            this.recordedChunks = [];
        }
    },

    // Refresh notes list after recording
    async refreshNotesList() {
        try {
            const notes = await VoiceNotesAPI.loadSavedNotes();
            VoiceNotesUI.displayNotes(notes);
        } catch (error) {
            console.error('Error refreshing notes list:', error);
            // Don't show error to user as this is secondary functionality
        }
    },

    // Handle file upload
    async handleFileUpload(file) {
        if (!file) {
            return false;
        }

        try {
            VoiceNotesUI.setProcessingState(true);
            VoiceNotesUI.showStatus('Processing uploaded file...', 'success');

            // Get selected folder from UI
            const selectedFolder = VoiceNotesUI.elements.folderSelect.value;
            
            // Process file through API
            const result = await VoiceNotesAPI.processFileUpload(file, selectedFolder);
            
            // Display results
            VoiceNotesUI.displayTranscription(result);
            VoiceNotesUI.showStatus(`✅ File transcribed and saved to ${result.folder_used || selectedFolder}`, 'success');
            
            // Refresh notes list
            await this.refreshNotesList();
            
            return true;
        } catch (error) {
            console.error('Error processing file:', error);
            VoiceNotesUI.showStatus('Error: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
            return false;
        } finally {
            VoiceNotesUI.setProcessingState(false);
        }
    },

    // Start new recording (discard current transcription)
    startNewRecording() {
        VoiceNotesUI.clearTranscription();
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Start new recording after a brief delay
        setTimeout(() => {
            if (!this.isRecording) {
                this.startRecording();
            }
        }, 100);
    },

    // Discard current session
    discardSession() {
        VoiceNotesUI.clearTranscription();
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        VoiceNotesUI.showStatus('Session discarded', 'success');
    },

    // Get recording duration
    getRecordingDuration() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    },

    // Check if microphone is available
    async checkMicrophoneAvailability() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'audioinput');
        } catch (error) {
            console.error('Error checking microphone availability:', error);
            return false;
        }
    },

    // ADD: Enable prototype mode
    enablePrototypeMode() {
        this.prototypeMode = true;
        this.sessionId = 'proto_' + Date.now();
        this.chunkCounter = 0;
        this.checkpointResults = [];
        console.log('Prototype mode enabled, session:', this.sessionId);
    },

    // ADD: Upload checkpoint method
    async uploadCheckpoint(audioBlob, chunkNumber) {
        if (!this.prototypeMode) return;
        
        try {
            const formData = new FormData();
            formData.append('session_id', this.sessionId);
            formData.append('chunk_number', chunkNumber);
            formData.append('audio', audioBlob, `chunk_${chunkNumber}.wav`);
            
            const response = await fetch('/prototype/checkpoint', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            this.checkpointResults.push(result);
            
            console.log(`Checkpoint ${chunkNumber} saved:`, result);
            VoiceNotesUI.showStatus(`Saved checkpoint ${chunkNumber}`, 'success');
            
            return result;
        } catch (error) {
            console.error('Checkpoint upload failed:', error);
            VoiceNotesUI.showStatus(`Checkpoint ${chunkNumber} failed`, 'error');
            return null;
        }
    },

    // ADD: Test concatenation method
    async testConcatenation() {
        if (!this.prototypeMode || !this.sessionId) {
            console.error('No prototype session to concatenate');
            return;
        }
        
        try {
            VoiceNotesUI.showStatus('Testing concatenation...', 'success');
            
            const formData = new FormData();
            formData.append('session_id', this.sessionId);
            
            const response = await fetch('/prototype/concatenate', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            console.log('Concatenation result:', result);
            
            if (result.status === 'success') {
                VoiceNotesUI.showStatus(
                    `✅ Concatenated ${result.chunk_count} chunks (${result.duration_ms}ms)`, 
                    'success'
                );
            } else {
                VoiceNotesUI.showStatus(`❌ Concatenation failed: ${result.error}`, 'error');
            }
            
            return result;
        } catch (error) {
            console.error('Concatenation test failed:', error);
            VoiceNotesUI.showStatus('Concatenation test failed', 'error');
        }
    },

    // Cleanup resources
    cleanup() {
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.stopTimer();
        
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isInitialized = false;
    },

    // Get recording statistics
    getStats() {
        return {
            isRecording: this.isRecording,
            isInitialized: this.isInitialized,
            duration: this.getRecordingDuration(),
            chunksCount: this.recordedChunks.length,
            recordedSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
            prototypeMode: this.prototypeMode,
            sessionId: this.sessionId,
            checkpointCount: this.checkpointResults.length
        };
    }
};

// Export for use in other modules
window.VoiceNotesRecording = VoiceNotesRecording;
            