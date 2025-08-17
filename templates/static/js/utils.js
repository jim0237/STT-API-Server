// Voice Notes Utility Functions
// templates/static/js/utils.js

const VoiceNotesUtils = {
    // URL and User Code utilities
    getUserCodeFromURL() {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length >= 3 && pathParts[1] === 'user') {
            return pathParts[2];
        }
        return null;
    },

    buildAPIURL(endpoint, userCode) {
        if (!userCode) {
            throw new Error('User code not available');
        }
        return `/user/${userCode}${endpoint}`;
    },

    // Time formatting utilities
    formatRecordingTime(duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    formatTimestamp(date) {
        return date.toLocaleString();
    },

    // Storage utilities
    saveSettings(userCode, settings) {
        const key = VoiceNotesConfig.storage.settingsPrefix + userCode;
        localStorage.setItem(key, JSON.stringify(settings));
    },

    loadSettings(userCode) {
        try {
            const key = VoiceNotesConfig.storage.settingsPrefix + userCode;
            const settings = JSON.parse(localStorage.getItem(key));
            return settings || {};
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    },

    // Validation utilities
    validateUserCode(userCode) {
        return userCode && typeof userCode === 'string' && userCode.length >= 6;
    },

    validateAudioFile(file) {
        if (!file) return { valid: false, error: 'No file selected' };
        
        const maxSize = VoiceNotesConfig.audio.upload.maxFileSize;
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB` 
            };
        }

        if (!file.type.startsWith('audio/')) {
            return { valid: false, error: 'Please select an audio file' };
        }

        return { valid: true };
    },

    // Array utilities
    ensureArray(value) {
        return Array.isArray(value) ? value : [];
    },

    // Error handling utilities
    getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && error.message) {
            return error.message;
        }
        return 'An unknown error occurred';
    },

    // Confidence score utilities
    formatConfidence(probability) {
        return `${Math.round(probability * 100)}% confidence`;
    },

    // DOM utilities
    createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    },

    // Debounce utility for performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Safe async wrapper
    async safeAsync(asyncFn, errorMessage = 'Operation failed') {
        try {
            return await asyncFn();
        } catch (error) {
            console.error(errorMessage, error);
            throw new Error(`${errorMessage}: ${this.getErrorMessage(error)}`);
        }
    }
};

// Export for use in other modules
window.VoiceNotesUtils = VoiceNotesUtils;