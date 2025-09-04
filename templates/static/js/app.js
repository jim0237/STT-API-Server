// Voice Notes Main Application
// templates/static/js/app.js

//This script serves as the main entry point for the frontend application. 
// It initializes all other JavaScript modules, manages the overall application state, 
// and handles the core event listeners for user interactions.
const VoiceNotesApp = {
    // Application state
    isInitialized: false,
    currentUserCode: null,
    currentTranscription: null,

    // Initialize the entire application
    async initialize() {
        try {
            console.log('Initializing Voice Notes application...');
            
            // Initialize UI elements first
            VoiceNotesUI.initializeElements();
            VoiceNotesUI.showStatus('Initializing...', 'success');
            
            // Get user code from URL
            this.currentUserCode = VoiceNotesUtils.getUserCodeFromURL();
            if (!this.currentUserCode) {
                throw new Error('Invalid user URL - user code not found');
            }
            
            // Display user code in UI
            VoiceNotesUI.setUserCode(this.currentUserCode);
            
            // Initialize API with user code
            VoiceNotesAPI.initialize(this.currentUserCode);
            
            // Load user data and initialize components in parallel
            await Promise.all([
                this.initializeUserData(),
                this.initializeRecording(),
                this.initializeEventListeners()
            ]);
            
            // Load user settings
            this.loadUserSettings();
            
            this.isInitialized = true;
            VoiceNotesUI.showStatus(`Ready to record as ${this.currentUserCode}`, 'success');
            
            console.log('Voice Notes application initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            VoiceNotesUI.showStatus('Initialization failed: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
            return false;
        }
    },

    // Initialize user-specific data
    async initializeUserData() {
        try {
            VoiceNotesUI.setNotesLoading(true);
            
            // Load folders and notes
            const userData = await VoiceNotesAPI.loadUserData();
            
            // Handle folders
            if (userData.folders.length > 0) {
                VoiceNotesUI.populateFolders(userData.folders);
            } else {
                VoiceNotesUI.handleFolderLoadError();
                console.warn('No folders loaded, using defaults');
            }
            
            // Handle notes
            VoiceNotesUI.displayNotes(userData.notes);
            
            // Log any errors that occurred during loading
            if (userData.errors.length > 0) {
                console.warn('Errors during user data loading:', userData.errors);
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            VoiceNotesUI.handleFolderLoadError();
            VoiceNotesUI.displayNotesError(error);
        } finally {
            VoiceNotesUI.setNotesLoading(false);
        }
    },

    // Initialize recording functionality
    async initializeRecording() {
        const success = await VoiceNotesRecording.initialize();
        if (!success) {
            console.warn('Recording initialization failed - upload functionality only');
        }
        return success;
    },

    // Set up all event listeners
    initializeEventListeners() {
        const elements = VoiceNotesUI.elements;
        
        // Recording controls
        elements.recordBtn.addEventListener('click', () => this.handleRecordingToggle());
        elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Action buttons
        elements.copyBtn.addEventListener('click', () => this.handleCopyTranscription());
        elements.reRecordBtn.addEventListener('click', () => this.handleReRecord());
        elements.discardBtn.addEventListener('click', () => this.handleDiscard());
        
        // Settings
        elements.folderSelect.addEventListener('change', () => this.handleSettingsChange());
        elements.autoSaveToggle.addEventListener('change', () => this.handleSettingsChange());
        
        // UPDATED: Prototype controls with new buttons
        document.getElementById('enablePrototypeBtn').addEventListener('click', () => {
            VoiceNotesRecording.enablePrototypeMode();
            document.getElementById('startPrototypeRecordingBtn').disabled = false;
            document.getElementById('transcribeChunksBtn').disabled = false;
            document.getElementById('assembleTextBtn').disabled = false;
            this.updatePrototypeStatus('Prototype mode enabled');
        });
        
        document.getElementById('startPrototypeRecordingBtn').addEventListener('click', () => {
            this.startPrototypeRecording();
        });
        
        // NEW: Transcribe chunks button
        document.getElementById('transcribeChunksBtn').addEventListener('click', async () => {
            await this.transcribeAllChunks();
        });
        
        // NEW: Assemble text button
        document.getElementById('assembleTextBtn').addEventListener('click', async () => {
            await this.assembleSessionText();
        });
        
        document.getElementById('listSessionsBtn').addEventListener('click', async () => {
            await this.listPrototypeSessions();
        });
        
        // Keyboard shortcuts
        if (VoiceNotesConfig.features.keyboardShortcuts) {
            this.initializeKeyboardShortcuts();
        }
        
    // NEW: VAD Test button
        document.getElementById('testVADBtn').addEventListener('click', async () => {
        await VoiceNotesRecording.testVAD();
});

        console.log('Event listeners initialized');
    },

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Space bar to start/stop recording (when not focused on input)
            if (e.code === VoiceNotesConfig.shortcuts.toggleRecording && 
                e.target.tagName !== 'TEXTAREA' && 
                e.target.tagName !== 'INPUT') {
                e.preventDefault();
                this.handleRecordingToggle();
            }
            
            // Ctrl/Cmd + C to copy transcription
            if ((e.ctrlKey || e.metaKey) && 
                e.code === VoiceNotesConfig.shortcuts.copyTranscription && 
                VoiceNotesUI.elements.transcriptionSection.classList.contains('visible')) {
                if (e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.handleCopyTranscription();
                }
            }
        });
        
        console.log('Keyboard shortcuts initialized');
    },

    // Event Handlers
    async handleRecordingToggle() {
        if (!this.isInitialized) return;
        
        try {
            await VoiceNotesRecording.toggleRecording();
        } catch (error) {
            console.error('Recording toggle failed:', error);
            VoiceNotesUI.showStatus('Recording failed: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
        }
    },

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            await VoiceNotesRecording.handleFileUpload(file);
        } catch (error) {
            console.error('File upload failed:', error);
            VoiceNotesUI.showStatus('Upload failed: ' + VoiceNotesUtils.getErrorMessage(error), 'error');
        } finally {
            // Clear file input
            event.target.value = '';
        }
    },

    async handleCopyTranscription() {
        try {
            await VoiceNotesUI.copyToClipboard();
        } catch (error) {
            console.error('Copy failed:', error);
        }
    },

    handleReRecord() {
        try {
            VoiceNotesRecording.startNewRecording();
        } catch (error) {
            console.error('Re-record failed:', error);
            VoiceNotesUI.showStatus('Failed to start new recording', 'error');
        }
    },

    handleDiscard() {
        try {
            VoiceNotesRecording.discardSession();
            this.currentTranscription = null;
        } catch (error) {
            console.error('Discard failed:', error);
        }
    },

    handleSettingsChange() {
        if (!this.isInitialized) return;
        
        try {
            this.saveUserSettings();
        } catch (error) {
            console.error('Settings save failed:', error);
        }
    },

    // Prototype helper methods
    async startPrototypeRecording() {
        // Record for exactly 60 seconds in 20-second chunks (3 chunks)
        this.updatePrototypeStatus('Starting 60-second test recording (3x20s chunks)...');
        
        // Start recording in prototype mode
        if (VoiceNotesRecording.canRecord()) {
            await VoiceNotesRecording.startRecording();
            
            // Stop after 60 seconds
            setTimeout(() => {
                if (VoiceNotesRecording.isRecording) {
                    VoiceNotesRecording.stopRecording();
                    this.updatePrototypeStatus('60-second test recording completed\nNext: Click "Transcribe Chunks"');
                }
            }, 60000);
        } else {
            this.updatePrototypeStatus('Cannot start recording - check microphone access');
        }
    },

    // NEW: Transcribe all chunks in current session
    async transcribeAllChunks() {
        if (!VoiceNotesRecording.prototypeMode || !VoiceNotesRecording.sessionId) {
            this.updatePrototypeStatus('No prototype session to transcribe');
            return;
        }

        try {
            this.updatePrototypeStatus('Transcribing chunks with Whisper...');
            
            const sessionId = VoiceNotesRecording.sessionId;
            const chunkCount = VoiceNotesRecording.checkpointResults.length;
            
            let transcriptionResults = [];
            
            // Transcribe each chunk individually
            for (let i = 0; i < chunkCount; i++) {
                this.updatePrototypeStatus(`Transcribing chunk ${i + 1} of ${chunkCount}...`);
                
                const formData = new FormData();
                formData.append('session_id', sessionId);
                formData.append('chunk_number', i);
                
                const response = await fetch('/prototype/transcribe-chunk', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                transcriptionResults.push(result);
                
                if (result.status === 'success') {
                    console.log(`Chunk ${i} transcribed: "${result.transcription.substring(0, 50)}..."`);
                } else {
                    console.error(`Chunk ${i} transcription failed:`, result.error);
                }
            }
            
            // Display results
            const successCount = transcriptionResults.filter(r => r.status === 'success').length;
            const failCount = transcriptionResults.filter(r => r.status === 'failed').length;
            
            let statusText = `Transcription complete: ${successCount} success, ${failCount} failed\n\n`;
            
            transcriptionResults.forEach((result, index) => {
                if (result.status === 'success') {
                    const preview = result.transcription.length > 50 
                        ? result.transcription.substring(0, 50) + '...'
                        : result.transcription;
                    statusText += `Chunk ${index}: "${preview}" (${result.transcription.length} chars)\n`;
                } else {
                    statusText += `Chunk ${index}: FAILED - ${result.error}\n`;
                }
            });
            
            statusText += '\nNext: Click "Assemble Text" to combine chunks';
            this.updatePrototypeStatus(statusText);
            
        } catch (error) {
            console.error('Chunk transcription failed:', error);
            this.updatePrototypeStatus('Chunk transcription failed: ' + error.message);
        }
    },

    // NEW: Assemble session text from individual transcriptions
    async assembleSessionText() {
        if (!VoiceNotesRecording.prototypeMode || !VoiceNotesRecording.sessionId) {
            this.updatePrototypeStatus('No prototype session to assemble');
            return;
        }

        try {
            this.updatePrototypeStatus('Assembling final text...');
            
            const formData = new FormData();
            formData.append('session_id', VoiceNotesRecording.sessionId);
            
            const response = await fetch('/prototype/assemble-session', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            console.log('Assembly result:', result);
            
            if (result.status === 'success') {
                // Display final transcription in the main UI
                VoiceNotesUI.elements.transcriptionText.value = result.final_transcription;
                VoiceNotesUI.elements.confidenceBadge.textContent = `${result.chunk_count} chunks combined`;
                VoiceNotesUI.elements.transcriptionSection.classList.add('visible');
                
                // Update prototype status
                let statusText = `✅ SUCCESS: Combined ${result.chunk_count} chunks\n`;
                statusText += `Final length: ${result.total_length} characters\n\n`;
                statusText += 'Individual chunks:\n';
                
                result.chunk_details.forEach((chunk, index) => {
                    statusText += `${index + 1}. ${chunk.preview} (${chunk.length} chars)\n`;
                });
                
                statusText += '\n📝 Final transcription displayed above. You can copy/edit it.';
                this.updatePrototypeStatus(statusText);
                
                VoiceNotesUI.showStatus('✅ Prototype test complete - check transcription above', 'success');
                
            } else {
                this.updatePrototypeStatus(`❌ Assembly failed: ${result.error}`);
            }
            
        } catch (error) {
            console.error('Text assembly failed:', error);
            this.updatePrototypeStatus('Text assembly failed: ' + error.message);
        }
    },

    async listPrototypeSessions() {
        try {
            const response = await fetch('/prototype/sessions');
            const data = await response.json();
            
            let statusText = 'Prototype Sessions:\n';
            if (data.sessions && data.sessions.length > 0) {
                data.sessions.forEach(session => {
                    statusText += `- ${session.session_id}:\n`;
                    statusText += `  Audio chunks: ${session.chunk_count}\n`;
                    statusText += `  Transcriptions: ${session.transcript_count}\n`;
                    statusText += `  Created: ${session.created}\n\n`;
                });
            } else {
                statusText += 'No sessions found';
            }
            
            this.updatePrototypeStatus(statusText);
        } catch (error) {
            this.updatePrototypeStatus('Error listing sessions: ' + error.message);
        }
    },

    updatePrototypeStatus(message) {
        const statusDiv = document.getElementById('prototypeStatus');
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    },

    // Settings Management
    loadUserSettings() {
        try {
            const settings = VoiceNotesUtils.loadSettings(this.currentUserCode);
            VoiceNotesUI.loadSettingsToUI(settings);
            console.log('User settings loaded:', settings);
        } catch (error) {
            console.error('Error loading user settings:', error);
        }
    },

    saveUserSettings() {
        try {
            const settings = {
                ...VoiceNotesUI.getSettingsFromUI(),
                userCode: this.currentUserCode,
                lastUpdated: new Date().toISOString()
            };
            
            VoiceNotesUtils.saveSettings(this.currentUserCode, settings);
            VoiceNotesUI.showStatus('Settings saved', 'success');
            console.log('User settings saved:', settings);
        } catch (error) {
            console.error('Error saving settings:', error);
            VoiceNotesUI.showStatus('Failed to save settings', 'error');
        }
    },

    // Refresh application data
    async refreshData() {
        if (!this.isInitialized) return;
        
        try {
            VoiceNotesUI.setNotesLoading(true);
            const notes = await VoiceNotesAPI.loadSavedNotes();
            VoiceNotesUI.displayNotes(notes);
        } catch (error) {
            console.error('Error refreshing data:', error);
            VoiceNotesUI.displayNotesError(error);
        } finally {
            VoiceNotesUI.setNotesLoading(false);
        }
    },

    // Health check
    async performHealthCheck() {
        try {
            const health = await VoiceNotesAPI.checkHealth();
            console.log('Server health:', health);
            return health;
        } catch (error) {
            console.error('Health check failed:', error);
            VoiceNotesUI.showStatus('Server connection issue', 'error');
            return null;
        }
    },

    // Get application status
    getStatus() {
        return {
            initialized: this.isInitialized,
            userCode: this.currentUserCode,
            recording: VoiceNotesRecording.getStats(),
            hasTranscription: !!this.currentTranscription
        };
    },

    // Cleanup and shutdown
    cleanup() {
        console.log('Cleaning up Voice Notes application...');
        
        try {
            VoiceNotesRecording.cleanup();
            this.currentTranscription = null;
            this.isInitialized = false;
            
            console.log('Application cleanup completed');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Voice Notes...');
    
    try {
        await VoiceNotesApp.initialize();
    } catch (error) {
        console.error('Failed to initialize Voice Notes application:', error);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    VoiceNotesApp.cleanup();
});

// Export for debugging and external access
window.VoiceNotesApp = VoiceNotesApp;