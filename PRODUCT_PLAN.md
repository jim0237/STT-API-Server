
# Product Plan: Speech-to-Text (STT) API Server

## 1. Overview

This document outlines the product plan for the Speech-to-Text (STT) API Server. The application is a web-based service that provides audio transcription capabilities using the `faster-whisper` implementation of OpenAI's Whisper model. It includes a user-friendly web interface, a robust API, and a user management system for organizing and storing transcriptions.

## 2. Core Components

The application is comprised of the following core components:

### 2.1. Backend API (FastAPI)

*   **Purpose:** The backend is the heart of the application, responsible for handling all business logic, including API requests, audio processing, transcription, and file management.
*   **Technology:** Built with Python and the [FastAPI](https://fastapi.tiangolo.com/) framework, providing a high-performance and scalable foundation.
*   **Key Features:**
    *   **Transcription Endpoints:** Multiple endpoints for transcribing audio files, including legacy endpoints for backward compatibility and new user-specific endpoints.
    *   **User Management:** A simple user management system based on a `users.txt` file, allowing for the creation of user-specific directories and organization of transcribed notes.
    *   **File Management:** Handles the uploading, processing, and storage of audio files and their corresponding transcriptions.
    *   **Chunking/Prototyping:** Includes experimental endpoints for transcribing large audio files by breaking them into smaller chunks.
    *   **Health Check:** A `/health` endpoint to monitor the status of the application and the underlying hardware (CPU/GPU).

### 2.2. Frontend Web Interface (Jinja2/JavaScript)

*   **Purpose:** The frontend provides a user-friendly web interface for interacting with the STT service.
*   **Technology:** Built with [Jinja2](https://jinja.palletsprojects.com/en/3.1.x/) templates and vanilla JavaScript, with a modular structure.
*   **Key Features:**
    *   **Modular Design:** The frontend code is organized into several files, each with a specific responsibility (`app.js`, `api.js`, `recording.js`, `ui.js`, `utils.js`).
    *   **Audio Recording:** The `recording.js` module handles microphone access, audio recording, and stopping recordings.
    *   **Voice Activity Detection (VAD):** The application uses the `silero-vad` library to detect speech in the audio stream, allowing for more efficient transcription by filtering out silence.
    *   **File Upload:** Allows users to upload audio files for transcription.
    *   **Transcription Display:** Displays the transcribed text to the user.
    *   **User-Specific Views:** Provides personalized views for each user, showing their saved notes and allowing them to organize their transcriptions into folders.

### 2.3. Speech-to-Text Engine (faster-whisper)

*   **Purpose:** The core STT engine is responsible for converting audio to text.
*   **Technology:** Utilizes the [`faster-whisper`](https://github.com/guillaumekln/faster-whisper) library, which is a reimplementation of OpenAI's Whisper model using CTranslate2.
*   **Key Features:**
    *   **High Performance:** `faster-whisper` is significantly faster and uses less memory than the original Whisper implementation.
    *   **Accuracy:** Achieves state-of-the-art accuracy in speech recognition.
    *   **Multilingual:** Supports a wide range of languages.
    *   **Hardware Acceleration:** Can leverage NVIDIA GPUs for even faster transcription speeds.

## 3. User Management

The application includes a simple but effective user management system.

*   **User Codes:** Each user is assigned a unique code.
*   **`users.txt`:** A simple text file (`users.txt`) maps user codes to directory names.
*   **User-Specific Directories:** Each user has their own directory where their audio files and transcriptions are stored.
*   **Folder Organization:** Within each user's directory, notes can be organized into predefined folders: `daily_notes`, `meeting_notes`, `ideas`, and `research`.

## 4. Important Files

Here is a list of the most important files in the codebase:

*   `main-ui.py`: The main FastAPI application file that contains the core backend logic.
*   `requirements.txt`: Lists all the Python dependencies required for the project.
*   `Dockerfile`: Contains the instructions to build the Docker container for the application.
*   `docker-compose.yml`: Defines the services, networks, and volumes for a multi-container Docker application.
*   `templates/index.html`: The main HTML file for the user interface.
*   `templates/static/js/app.js`: The main JavaScript file for the frontend application, handling initialization and state.
*   `templates/static/js/api.js`: Manages all communication between the frontend and the backend API.
*   `templates/static/js/recording.js`: Handles audio recording, including microphone access and Voice Activity Detection (VAD).
*   `templates/static/js/ui.js`: Manages all UI elements and their interactions.
*   `templates/static/js/utils.js`: Provides a set of helper functions for the frontend.
*   `PRODUCT_PLAN.md`: This document, which outlines the product plan and project structure.

## 5. Phase 0: VAD Support

Voice Activity Detection (VAD) is already implemented in the frontend as part of the initial phase of development.

*   **Purpose:** VAD is crucial for pre-processing audio streams to identify and extract segments of speech. This improves the efficiency and accuracy of the transcription process by filtering out silence and non-speech audio.
*   **Implementation:**
    *   **Library:** The frontend uses the [`silero-vad`](https://github.com/snakers4/silero-vad) library for VAD.
    *   **Integration:** VAD is integrated into the `recording.js` module. It analyzes the audio stream from the microphone in real-time and detects when the user is speaking.

## 6. Future Improvements

Based on the current codebase, here are some potential areas for future improvement:

*   **Database Integration:** Replace the `users.txt` file with a proper database (e.g., SQLite, PostgreSQL) for more robust user management and scalability.
*   **Real-time Transcription:** Enhance the frontend to provide a real-time transcription experience as the user is speaking or after the audio is uploaded.
*   **Enhanced Frontend:** Improve the user interface with a more modern JavaScript framework (e.g., React, Vue.js) to provide a richer user experience.
*   **Authentication and Authorization:** Implement a more secure authentication system (e.g., OAuth2, JWT) to protect user data.
*   **Dockerization and Deployment:** The presence of a `Dockerfile` and `docker-compose.yml` suggests that the application is designed for containerization. Further work could be done to streamline the deployment process to cloud platforms (e.g., AWS, Google Cloud, Azure).
*   **Testing:** While there are some prototype endpoints, there is no formal testing suite. Adding unit and integration tests would improve the reliability and maintainability of the codebase.
