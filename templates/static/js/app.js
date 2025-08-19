// Voice Notes Main Application
// templates/static/js/app.js

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
        
        // Keyboard shortcuts
        if (VoiceNotesConfig.features.keyboardShortcuts) {
            this.initializeKeyboardShortcuts();
        }
        
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