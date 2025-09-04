// Voice Notes API Communication
// templates/static/js/api.js

//Description: This file manages all communication between the frontend and the backend API. 
// It provides functions for sending audio data for transcription, 
// fetching saved notes, and loading user-specific data.

const VoiceNotesAPI = {
    // Current user code (set during initialization)
    currentUserCode: null,

    // Initialize API with user code
    initialize(userCode) {
        if (!VoiceNotesUtils.validateUserCode(userCode)) {
            throw new Error('Invalid user code provided');
        }
        this.currentUserCode = userCode;
    },

    // Build API URL for current user
    buildURL(endpoint) {
        if (!this.currentUserCode) {
            throw new Error('API not initialized with user code');
        }
        return VoiceNotesUtils.buildAPIURL(endpoint, this.currentUserCode);
    },

    // Generic fetch wrapper with error handling
    async fetchWithTimeout(url, options = {}) {
        const timeout = options.timeout || VoiceNotesConfig.api.timeouts.transcription;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    },

    // Load available folders for user
    async loadFolders() {
        try {
            const url = this.buildURL(VoiceNotesConfig.api.endpoints.browseFolder);
            const response = await this.fetchWithTimeout(url);
            const data = await response.json();
            
            return VoiceNotesUtils.ensureArray(data.folders);
        } catch (error) {
            console.error('Error loading folders:', error);
            throw new Error('Failed to load folders: ' + VoiceNotesUtils.getErrorMessage(error));
        }
    },

    // Transcribe and save audio
    async transcribeAndSave(audioBlob, filename, selectedFolder) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, filename);
            
            // Validate folder selection
            const folder = selectedFolder && selectedFolder !== '' ? selectedFolder : 'daily_notes';
            formData.append('folder', folder);

            console.log(`User ${this.currentUserCode} - Transcribing to folder:`, folder);

            const url = this.buildURL(VoiceNotesConfig.api.endpoints.transcribeAndSave);
            const response = await this.fetchWithTimeout(url, {
                method: 'POST',
                body: formData,
                timeout: VoiceNotesConfig.api.timeouts.transcription
            });

            const data = await response.json();
            
            // Add folder used information for UI feedback
            data.folder_used = folder;
            
            return data;
        } catch (error) {
            console.error('Error in transcription:', error);
            throw new Error('Transcription failed: ' + VoiceNotesUtils.getErrorMessage(error));
        }
    },

    // Load saved notes for user
    async loadSavedNotes(folder = null) {
        try {
            let url = this.buildURL(VoiceNotesConfig.api.endpoints.savedNotes);
            if (folder) {
                url += `?folder=${encodeURIComponent(folder)}`;
            }

            const response = await this.fetchWithTimeout(url);
            const data = await response.json();
            
            return VoiceNotesUtils.ensureArray(data.notes);
        } catch (error) {
            console.error('Error loading notes:', error);
            throw new Error('Failed to load notes: ' + VoiceNotesUtils.getErrorMessage(error));
        }
    },

    // Check server health
    async checkHealth() {
        try {
            const response = await this.fetchWithTimeout('/health', {
                timeout: VoiceNotesConfig.api.timeouts.health
            });
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            throw new Error('Server health check failed: ' + VoiceNotesUtils.getErrorMessage(error));
        }
    },

    // Validate file before upload
    validateFile(file) {
        return VoiceNotesUtils.validateAudioFile(file);
    },

    // Process file upload (wrapper for transcribeAndSave)
    async processFileUpload(file, selectedFolder) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        return await this.transcribeAndSave(file, file.name, selectedFolder);
    },

    // Process recorded audio (wrapper for transcribeAndSave)
    async processRecording(audioBlob, selectedFolder) {
        if (!audioBlob || audioBlob.size === 0) {
            throw new Error('No audio data to process');
        }

        return await this.transcribeAndSave(audioBlob, 'recorded_audio.wav', selectedFolder);
    },

    // Batch operations (for future use)
    async loadUserData() {
        try {
            const [folders, notes] = await Promise.allSettled([
                this.loadFolders(),
                this.loadSavedNotes()
            ]);

            return {
                folders: folders.status === 'fulfilled' ? folders.value : [],
                notes: notes.status === 'fulfilled' ? notes.value : [],
                errors: [
                    ...(folders.status === 'rejected' ? [folders.reason] : []),
                    ...(notes.status === 'rejected' ? [notes.reason] : [])
                ]
            };
        } catch (error) {
            console.error('Error loading user data:', error);
            throw new Error('Failed to load user data: ' + VoiceNotesUtils.getErrorMessage(error));
        }
    },

    // Error recovery helpers
    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }
        
        throw new Error(`Operation failed after ${maxRetries} attempts: ${VoiceNotesUtils.getErrorMessage(lastError)}`);
    }
};

// Export for use in other modules
window.VoiceNotesAPI = VoiceNotesAPI;