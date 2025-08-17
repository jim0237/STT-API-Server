// Voice Notes Configuration
// templates/static/config/settings.js

const VoiceNotesConfig = {
    // API Configuration
    api: {
        endpoints: {
            browseFolder: '/browse-folders',
            transcribeAndSave: '/transcribe-and-save',
            savedNotes: '/saved-notes',
            health: '/health'
        },
        timeouts: {
            transcription: 30000,  // 30 seconds
            health: 5000          // 5 seconds
        }
    },

    // UI Configuration
    ui: {
        timers: {
            recordingUpdate: 100,     // Recording timer update interval (ms)
            statusMessageDuration: 3000,  // Status message display time (ms)
            settingsAutoSave: 100     // Settings auto-save delay (ms)
        },
        defaults: {
            folder: 'daily_notes',
            autoSave: true,
            statusMessage: 'Ready to record'
        }
    },

    // Audio Configuration
    audio: {
        recording: {
            mimeType: 'audio/wav',
            sampleRate: 44100,
            channelCount: 1
        },
        upload: {
            acceptedFormats: 'audio/*',
            maxFileSize: 50 * 1024 * 1024  // 50MB
        }
    },

    // Keyboard Shortcuts
    shortcuts: {
        toggleRecording: 'Space',
        copyTranscription: 'KeyC'  // Ctrl/Cmd + C
    },

    // Storage Keys
    storage: {
        settingsPrefix: 'voiceNotesSettings_'
    },

    // Feature Flags
    features: {
        keyboardShortcuts: true,
        autoSave: true,
        confidenceDisplay: true,
        recentNotes: true
    }
};

// Export for use in other modules
window.VoiceNotesConfig = VoiceNotesConfig;