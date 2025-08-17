// Voice Notes UI Management
// templates/static/js/ui.js

const VoiceNotesUI = {
    // DOM element references (initialized on load)
    elements: {},

    // Initialize DOM element references
    initializeElements() {
        this.elements = {
            // Recording controls
            recordBtn: document.getElementById('recordBtn'),
            recordStatus: document.getElementById('recordStatus'),
            recordTimer: document.getElementById('recordTimer'),
            fileInput: document.getElementById('fileInput'),
            
            // Transcription display
            transcriptionSection: document.getElementById('transcriptionSection'),
            transcriptionText: document.getElementById('transcriptionText'),
            confidenceBadge: document.getElementById('confidenceBadge'),
            
            // Settings and controls
            statusBar: document.getElementById('statusBar'),
            folderSelect: document.getElementById('folderSelect'),
            autoSaveToggle: document.getElementById('autoSaveToggle'),
            userCodeDisplay: document.getElementById('userCodeDisplay'),
            
            // Notes and lists
            notesList: document.getElementById('notesList'),
            notesSpinner: document.getElementById('notesSpinner'),
            
            // Action buttons
            copyBtn: document.getElementById('copyBtn'),
            reRecordBtn: document.getElementById('reRecordBtn'),
            discardBtn: document.getElementById('discardBtn')
        };

        // Validate that all required elements exist
        const missingElements = Object.entries(this.elements)
            .filter(([key, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.error('Missing DOM elements:', missingElements);
            throw new Error(`Required DOM elements not found: ${missingElements.join(', ')}`);
        }
    },

    // Status message management
    showStatus(message, type = 'success') {
        const statusBar = this.elements.statusBar;
        statusBar.textContent = message;
        statusBar.className = `status-bar visible ${type}`;
        
        setTimeout(() => {
            statusBar.classList.remove('visible');
        }, VoiceNotesConfig.ui.timers.statusMessageDuration);
    },

    // Recording UI state management
    setRecordingState(isRecording) {
        const { recordBtn, recordStatus } = this.elements;
        
        if (isRecording) {
            recordBtn.classList.add('recording');
            recordBtn.textContent = '⏹️';
            recordStatus.textContent = 'Recording...';
            document.body.classList.add('recording-active');
        } else {
            recordBtn.classList.remove('recording');
            recordBtn.textContent = '🎤';
            recordStatus.textContent = 'Ready to record';
            document.body.classList.remove('recording-active');
        }
    },

    setProcessingState(isProcessing) {
        const { recordBtn, recordStatus } = this.elements;
        
        if (isProcessing) {
            recordBtn.disabled = true;
            recordStatus.textContent = 'Processing...';
        } else {
            recordBtn.disabled = false;
            recordStatus.textContent = 'Ready to record';
        }
    },

    // Timer display
    updateRecordingTimer(duration) {
        this.elements.recordTimer.textContent = VoiceNotesUtils.formatRecordingTime(duration);
    },

    resetTimer() {
        this.elements.recordTimer.textContent = '00:00';
    },

    // Transcription display
    displayTranscription(data) {
        const { transcriptionText, confidenceBadge, transcriptionSection } = this.elements;
        
        transcriptionText.value = data.text;
        confidenceBadge.textContent = VoiceNotesUtils.formatConfidence(data.language_probability);
        transcriptionSection.classList.add('visible');
    },

    clearTranscription() {
        const { transcriptionSection, transcriptionText, confidenceBadge } = this.elements;
        
        transcriptionSection.classList.remove('visible');
        transcriptionText.value = '';
        confidenceBadge.textContent = 'Processing...';
    },

    // Folder management
    populateFolders(folders) {
        const folderSelect = this.elements.folderSelect;
        folderSelect.innerHTML = '';
        
        VoiceNotesUtils.ensureArray(folders).forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.value;
            option.textContent = `📁 ${folder.name}`;
            folderSelect.appendChild(option);
        });

        // Set default selection if folders available
        if (folders.length > 0) {
            folderSelect.value = folders[0].value;
        }
    },

    handleFolderLoadError() {
        const folderSelect = this.elements.folderSelect;
        folderSelect.innerHTML = `
            <option value="daily_notes">📁 Daily Notes</option>
            <option value="meeting_notes">📁 Meeting Notes</option>
            <option value="ideas">📁 Ideas</option>
            <option value="research">📁 Research</option>
        `;
        folderSelect.value = 'daily_notes';
    },

    // Notes list management
    displayNotes(notes) {
        const notesList = this.elements.notesList;
        notesList.innerHTML = '';
        
        if (notes && notes.length > 0) {
            notes.forEach(note => {
                const noteElement = this.createNoteElement(note);
                notesList.appendChild(noteElement);
            });
        } else {
            this.displayEmptyNotesMessage();
        }
    },

    displayEmptyNotesMessage() {
        this.elements.notesList.innerHTML = `
            <div class="note-item">
                <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                    No notes found. Start recording to create your first note!
                </div>
            </div>
        `;
    },

    displayNotesError(error) {
        this.elements.notesList.innerHTML = `
            <div class="note-item">
                <div style="text-align: center; color: var(--accent-danger); padding: 20px;">
                    Error loading notes: ${VoiceNotesUtils.getErrorMessage(error)}
                </div>
            </div>
        `;
    },

    createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-item';
        
        const timeString = VoiceNotesUtils.formatTimestamp(new Date(note.timestamp));
        const confidence = Math.round(note.language_probability * 100);
        
        noteDiv.innerHTML = `
            <div class="note-meta">
                <span>📁 ${note.folder_display} • ${timeString}</span>
                <span>🎯 ${confidence}% confidence</span>
            </div>
            <div class="note-preview">${note.content_preview}</div>
        `;
        
        // Add click handler to load note content
        noteDiv.addEventListener('click', () => {
            this.loadNoteContent(note);
        });
        
        return noteDiv;
    },

    loadNoteContent(note) {
        this.elements.transcriptionText.value = note.full_content;
        this.elements.transcriptionSection.classList.add('visible');
        this.showStatus('Note loaded for editing', 'success');
    },

    // Loading states
    setNotesLoading(isLoading) {
        this.elements.notesSpinner.style.display = isLoading ? 'block' : 'none';
    },

    // User code display
    setUserCode(userCode) {
        this.elements.userCodeDisplay.textContent = userCode;
    },

    // Settings management
    loadSettingsToUI(settings) {
        const { folderSelect, autoSaveToggle } = this.elements;
        
        if (settings.folder && folderSelect.querySelector(`option[value="${settings.folder}"]`)) {
            folderSelect.value = settings.folder;
        }
        
        if (typeof settings.autoSave === 'boolean') {
            autoSaveToggle.value = settings.autoSave ? 'true' : 'false';
        }
    },

    getSettingsFromUI() {
        return {
            folder: this.elements.folderSelect.value,
            autoSave: this.elements.autoSaveToggle.value === 'true'
        };
    },

    // Clipboard operations
    async copyToClipboard() {
        const text = this.elements.transcriptionText.value;
        if (!text) {
            this.showStatus('No text to copy', 'error');
            return false;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showStatus('📋 Copied to clipboard', 'success');
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            this.showStatus('Copy failed', 'error');
            return false;
        }
    },

    // Button state management
    setButtonsEnabled(enabled) {
        Object.values(this.elements).forEach(element => {
            if (element && element.tagName === 'BUTTON') {
                element.disabled = !enabled;
            }
        });
    }
};

// Export for use in other modules
window.VoiceNotesUI = VoiceNotesUI;