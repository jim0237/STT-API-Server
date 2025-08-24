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

    // Setup MediaRecorder event handlers
    setupRecorderEvents() {
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
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

            // Start MediaRecorder
            this.mediaRecorder.start(10); // Collect data every 10ms
            
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
            recordedSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0)
        };
    }
};

// Export for use in other modules
window.VoiceNotesRecording = VoiceNotesRecording;