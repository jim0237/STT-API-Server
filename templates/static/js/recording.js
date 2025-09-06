// Voice Notes Audio Recording Management
// templates/static/js/recording.js

//Description: This file manages all aspects of audio recording. 
// It handles microphone access, starting and stopping recordings, 
// capturing audio data, and interacting with 
// the Voice Activity Detection (VAD) library to detect speech.

const VoiceNotesRecording = {
    // Recording state
    mediaRecorder: null,
    recordedChunks: [],
    recordingInterval: null,
    startTime: null,
    isRecording: false,
    isInitialized: false,

    // Prototype properties
    prototypeMode: false,
    sessionId: null,
    chunkCounter: 0,
    checkpointResults: [],

    // VAD Properties
    vad: null,
    vadInitialized: false,
    audioContext: null,

    // PHASE 2 ADDITIONS: VAD-based segmentation
    vadSegments: [],           // Store audio segments from VAD
    transcriptionQueue: [],    // Queue for processing segments
    isProcessingQueue: false,  // Prevent concurrent transcription

    // Initialize microphone access and VAD
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
            
            // Initialize VAD
            await this.initializeVAD();
            
            this.isInitialized = true;
            
            VoiceNotesUI.setProcessingState(false);
            VoiceNotesUI.showStatus('Microphone and VAD ready', 'success');
            
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
        
        return 'audio/webm';
    },

    // Initialize Silero VAD
    async initializeVAD() {
        try {
            // Check if VAD library is loaded
            if (typeof vad === 'undefined') {
                throw new Error('Silero VAD library not loaded. Check script imports.');
            }

            console.log('Initializing Silero VAD...');
            
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Initialize VAD with event handlers
            this.vad = await vad.MicVAD.new({
                onSpeechStart: () => {
                    console.log('VAD: Speech started');
                    VoiceNotesUI.showStatus('VAD: Speech detected', 'success');
                },
                onSpeechEnd: (audio) => {
                    console.log('VAD: Speech ended, audio length:', audio.length);
                    VoiceNotesUI.showStatus('VAD: Speech segment captured', 'success');
                    
                    // PHASE 2: Use the improved handler
                    this.handleVADSegment(audio);
                },
                onVADMisfire: () => {
                    console.log('VAD: Misfire (false positive)');
                }
            });

            this.vadInitialized = true;
            console.log('Silero VAD initialized successfully');
            
        } catch (error) {
            console.error('VAD initialization failed:', error);
            VoiceNotesUI.showStatus('VAD initialization failed: ' + error.message, 'error');
            throw error;
        }
    },

    // PHASE 2: VAD-based audio collection (replaces broken MediaRecorder chunking)
    handleVADSegment(audioData) {
        console.log('VAD Segment captured:', {
            length: audioData.length,
            duration: `${(audioData.length / (this.audioContext?.sampleRate || 16000)).toFixed(2)}s`,
            timestamp: new Date().toISOString()
        });
        
        // Convert VAD audio data to blob
        const audioBlob = this.convertVADToBlob(audioData);
        
        if (this.prototypeMode) {
            // Store segment for processing
            this.vadSegments.push({
                blob: audioBlob,
                chunkNumber: this.chunkCounter++,
                timestamp: Date.now()
            });
            
            // Add to transcription queue
            this.queueForTranscription(audioBlob, this.chunkCounter - 1);
            
            VoiceNotesUI.showStatus(`VAD captured segment ${this.chunkCounter}`, 'success');
        }
    },

    // PHASE 2: Convert VAD Float32Array to audio blob
    convertVADToBlob(float32Array) {
        // Convert Float32Array to WAV blob
        const sampleRate = this.audioContext?.sampleRate || 16000;
        const numChannels = 1;
        const buffer = new ArrayBuffer(44 + float32Array.length * 2);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + float32Array.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, float32Array.length * 2, true);
        
        // Convert float32 to int16
        let offset = 44;
        for (let i = 0; i < float32Array.length; i++) {
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    },

    // PHASE 2: Queue management for transcription
    queueForTranscription(audioBlob, chunkNumber) {
        this.transcriptionQueue.push({
            blob: audioBlob,
            chunkNumber: chunkNumber,
            timestamp: Date.now()
        });
        
        // Process queue if not already processing
        if (!this.isProcessingQueue) {
            this.processTranscriptionQueue();
        }
    },

    // PHASE 2: Process transcription queue sequentially
    async processTranscriptionQueue() {
        if (this.isProcessingQueue || this.transcriptionQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.transcriptionQueue.length > 0) {
            const segment = this.transcriptionQueue.shift();
            
            try {
                console.log(`Processing segment ${segment.chunkNumber} (${this.transcriptionQueue.length} remaining in queue)`);
                VoiceNotesUI.showStatus(`Transcribing segment ${segment.chunkNumber}...`, 'success');
                
                // Upload to existing checkpoint endpoint
                await this.uploadCheckpoint(segment.blob, segment.chunkNumber);
                
                console.log(`Segment ${segment.chunkNumber} uploaded successfully`);
                
            } catch (error) {
                console.error(`Failed to process segment ${segment.chunkNumber}:`, error);
                VoiceNotesUI.showStatus(`Segment ${segment.chunkNumber} failed`, 'error');
            }
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.isProcessingQueue = false;
        console.log('Transcription queue processing complete');
    },

    // Setup MediaRecorder event handlers (MODIFIED for Phase 2)
    setupRecorderEvents() {
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
                
                // REMOVED: Broken prototype checkpoint logic
                // The VAD-based approach handles this in handleVADSegment()
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

    // Start recording (MODIFIED for Phase 2 VAD mode)
    startRecording() {
        if (!this.canRecord()) {
            VoiceNotesUI.showStatus('Cannot start recording', 'error');
            return false;
        }

        try {
            // Reset state
            this.recordedChunks = [];
            this.vadSegments = [];        // PHASE 2: Reset VAD segments
            this.transcriptionQueue = []; // PHASE 2: Reset queue
            this.isRecording = true;
            this.startTime = Date.now();

            // Start MediaRecorder - MODIFIED for VAD
            if (this.prototypeMode) {
                // VAD mode: continuous recording, VAD handles segmentation
                this.mediaRecorder.start();
                console.log('Started VAD-based recording (continuous)');
            } else {
                // Normal mode: keep existing behavior
                this.mediaRecorder.start(10);
            }
            
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
            VoiceNotesUI.showStatus(`Recording saved to ${result.folder_used || selectedFolder}`, 'success');
            
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
            VoiceNotesUI.showStatus(`File transcribed and saved to ${result.folder_used || selectedFolder}`, 'success');
            
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

    // Test VAD functionality
    async testVAD() {
        if (!this.vadInitialized) {
            VoiceNotesUI.showStatus('VAD not initialized', 'error');
            return false;
        }

        try {
            console.log('Testing VAD...');
            VoiceNotesUI.showStatus('Testing VAD - speak into microphone', 'success');
            
            await this.vad.start();
            console.log('VAD test started - speak to test speech detection');
            
            // Auto-stop test after 10 seconds
            setTimeout(() => {
                if (this.vad) {
                    this.vad.pause();
                    console.log('VAD test completed');
                    VoiceNotesUI.showStatus('VAD test completed - check console for events', 'success');
                }
            }, 10000);
            
            return true;
        } catch (error) {
            console.error('VAD test failed:', error);
            VoiceNotesUI.showStatus('VAD test failed: ' + error.message, 'error');
            return false;
        }
    },

    // Enable prototype mode
    enablePrototypeMode() {
        this.prototypeMode = true;
        this.sessionId = 'proto_' + Date.now();
        this.chunkCounter = 0;
        this.checkpointResults = [];
        console.log('Prototype mode enabled, session:', this.sessionId);
    },

    // Upload checkpoint method
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

    // Cleanup resources
    cleanup() {
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.stopTimer();
        
        // Cleanup VAD
        if (this.vad) {
            try {
                this.vad.pause();
            } catch (error) {
                console.warn('Error stopping VAD:', error);
            }
        }
        
        if (this.mediaRecorder && this.mediaRecorder.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.vad = null;
        this.vadInitialized = false;
        this.audioContext = null;
        this.isInitialized = false;
    },

    // Get recording statistics (ENHANCED for Phase 2)
    getStats() {
        return {
            isRecording: this.isRecording,
            isInitialized: this.isInitialized,
            vadInitialized: this.vadInitialized,
            duration: this.getRecordingDuration(),
            chunksCount: this.recordedChunks.length,
            recordedSize: this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0),
            prototypeMode: this.prototypeMode,
            sessionId: this.sessionId,
            checkpointCount: this.checkpointResults.length,
            // PHASE 2: Queue status
            vadSegmentCount: this.vadSegments?.length || 0,
            queueLength: this.transcriptionQueue?.length || 0,
            isProcessingQueue: this.isProcessingQueue
        };
    }
};

// Export for use in other modules
window.VoiceNotesRecording = VoiceNotesRecording;