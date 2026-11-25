# OpenClue Architecture

**OpenClue** is a local-first, transparent, open-source desktop AI assistant for live meetings, technical discussions, interviews, and research sessions.

## Design Principles

1. **Local-First & Private**: Audio, transcripts, screen OCR context, and session history are stored locally in SQLite. Nothing leaves the device unless the user explicitly configures and enables a cloud AI or cloud transcription provider.
2. **Transparent Productivity**: Recording, system audio capture, screen capture, and screen-sharing privacy states are always visible and user-controlled. No stealth or anti-proctoring mechanisms are implemented.
3. **Dual-Window Desktop UX**:
   - **Main Workspace Window**: Full productivity suite (Dashboard, Live Assistant, Session History, Transcript Viewer, AI/Audio/Screen/Provider/Privacy Settings).
   - **Floating Assistant Overlay**: Lightweight, always-on-top, draggable, resizable, collapsible window for quick questions, live transcript, and streaming answers during calls.
4. **OS-Approved Screen-Sharing Privacy Mode**: Uses `BrowserWindow.setContentProtection(true)` (Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows 10 2004+ and `NSWindow.SharingType.none` on macOS) so the private assistant overlay is excluded from meeting screen shares when enabled, with a clear UI indicator and safe fallback on unsupported platforms.

## System Topology

```
+-------------------------------------------------------------------+
|                     Electron Desktop Shell                        |
|  +-----------------------------+  +----------------------------+  |
|  |   Main Workspace Window     |  |  Floating Overlay Window   |  |
|  |  (React + TypeScript + TW)  |  | (Always-on-top + Privacy)  |  |
|  +--------------+--------------+  +-------------+--------------+  |
|                 |                               |                 |
|                 +---------------+---------------+                 |
|                                 | IPC (Preload Bridge)            |
|  +------------------------------v------------------------------+  |
|  |  Electron Main Process                                      |  |
|  |  - Window Manager (Main + Floating Overlay)                 |  |
|  |  - Content Protection (WDA_EXCLUDEFROMCAPTURE)              |  |
|  |  - Global Shortcuts (Ctrl+Shift+Space, Ctrl+Enter, etc.)    |  |
|  |  - OS Credential Vault (safeStorage / Windows DPAPI)        |  |
|  |  - Python Sidecar Lifecycle Manager                         |  |
|  +------------------------------+------------------------------+  |
+---------------------------------|---------------------------------+
                                  | HTTP REST + WebSocket (127.0.0.1)
+---------------------------------v---------------------------------+
|                  Python AI & Media Backend (FastAPI)              |
|  +--------------------+  +-------------------+  +--------------+  |
|  |   Audio Engine     |  | Transcription     |  | Screen OCR   |  |
|  | - Mic (PortAudio)  |->| - faster-whisper  |  | - mss        |  |
|  | - WASAPI Loopback  |  | - Cloud fallback  |  | - RapidOCR   |  |
|  | - VAD & Buffering  |  | - Partial/Final   |  | - Window sel.|  |
|  +--------------------+  +-------------------+  +--------------+  |
|                                 |                                 |
|  +------------------------------v------------------------------+  |
|  |  AI Assistant Engine & Context Assembler                    |  |
|  |  - System Instructions + User Profile + Reference Docs      |  |
|  |  - Recent Transcript + Screen OCR + Conversation History    |  |
|  |  - Streaming Providers: Ollama | OpenAI | Anthropic | Gemini|  |
|  +------------------------------+------------------------------+  |
|                                 |                                 |
|  +------------------------------v------------------------------+  |
|  |  Local Persistence (SQLite)                                 |  |
|  |  - Sessions, Transcripts, Messages, Summaries, Settings     |  |
|  +-------------------------------------------------------------+  |
+-------------------------------------------------------------------+
```

## Component Breakdown

### 1. Electron Main Process (`electron/`)
- Manages two `BrowserWindow` instances (`main` and `overlay`).
- Enforces `setContentProtection(true)` when Screen-Sharing Privacy Mode is active, and exposes capture-exclusion status to the renderer.
- Registers global shortcuts (`Ctrl+Shift+Space` to toggle overlay, `Ctrl+Enter` for quick ask, `Ctrl+Shift+M` to toggle mic, `Ctrl+Shift+P` to toggle privacy mode).
- Encrypts/decrypts provider API keys using `safeStorage` (Windows DPAPI) and stores encrypted blobs locally—never in plaintext `.env` or SQLite.
- Spawns and health-checks the local Python FastAPI backend on `127.0.0.1:<port>` with a per-launch random bearer token.

### 2. React Frontend (`src/`)
- Built with React 19, TypeScript, Vite, Tailwind CSS, and Lucide icons.
- Dark-first design system with light theme support.
- 10 dedicated views:
  1. Welcome & Onboarding
  2. Dashboard
  3. Live Assistant
  4. Session History
  5. Transcript Viewer
  6. AI Settings (instructions, style, length, background, reference docs)
  7. Audio Settings (mic, system loopback, noise gate, VAD)
  8. Screen Capture Settings (monitor/window selector, interval, OCR, privacy mode)
  9. Model Provider Settings (Ollama, OpenAI, Anthropic, Gemini, Whisper model)
  10. Privacy & Data Management (retention, export, selective/full deletion)

### 3. Python Backend (`backend/`)
- **Audio Engine (`backend/audio/`)**:
  - `AudioCaptureBackend` abstraction for cross-platform extensibility (Windows WASAPI loopback + PortAudio mic now; macOS CoreAudio/ScreenCaptureKit planned).
  - Real-time RMS/peak level metering streamed over WebSocket.
  - Energy-based Voice Activity Detection (VAD) and spectral noise gate.
  - Source attribution: Microphone -> `You`, System Loopback -> `System`.
- **Transcription Pipeline (`backend/transcription/`)**:
  - Local `faster-whisper` (`int8` CPU-optimized) with partial and final transcript segments, timestamps, and language selection.
  - Optional OpenAI-compatible cloud transcription when explicitly configured.
- **Screen Context Engine (`backend/screen/`)**:
  - Explicit user-triggered or interval-based capture of a selected monitor or application window.
  - Local `rapidocr-onnxruntime` text extraction.
  - Never captures without explicit user enablement; private OpenClue windows are excluded.
- **AI Assistant Engine (`backend/ai/`)**:
  - Unified `LLMProvider` interface with async token streaming.
  - Providers: Ollama (local), OpenAI, Anthropic, Google Gemini.
  - Structured Meeting Intelligence generator: summary, key points, decisions, action items, questions raised.
- **Storage (`backend/db/`)**:
  - SQLite database stored in the user's app data directory with foreign-key cascades for clean deletion.
