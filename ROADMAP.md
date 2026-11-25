# OpenClue Roadmap

## Phase 1: Research & Architecture (Completed)
- Evaluate Cluely public product category and open-source alternatives.
- Audit Windows audio loopback, screen capture, OCR, and capture-exclusion APIs.
- Audit third-party dependency and model licenses.
- Deliver `ARCHITECTURE.md`, `ROADMAP.md`, `TECHNICAL_DECISIONS.md`, and `LICENSE_AUDIT.md`.

## Phase 2: Desktop Foundation
- Initialize Electron + React + TypeScript + Vite + Tailwind CSS shell.
- Initialize Python (`uv`) FastAPI backend with SQLite schema and health checks.
- Implement IPC bridge, `safeStorage` credential vault, and design system (dark/light themes).
- Build all 10 application screens with real navigation and persistent settings.

## Phase 3: Audio & Real-Time Transcription
- Implement microphone device enumeration and capture (`sounddevice`).
- Implement Windows WASAPI loopback system audio capture (`pyaudiowpatch`).
- Implement real-time audio level metering, VAD, pause/resume, and WebSocket streaming.
- Integrate `faster-whisper` local transcription with partial/final updates and timestamps.

## Phase 4: AI Assistant Engine
- Implement `LLMProvider` abstraction with streaming SSE/WebSocket responses.
- Add Ollama (local), OpenAI, Anthropic, and Google Gemini providers.
- Implement context assembly (transcript + screen OCR + custom instructions + reference docs + history).

## Phase 5: Screen Context & Privacy Mode
- Implement monitor and window enumeration and explicit on-demand / interval capture.
- Integrate local `rapidocr-onnxruntime` OCR extraction.
- Implement OS-approved Screen-Sharing Privacy Mode (`setContentProtection` / `WDA_EXCLUDEFROMCAPTURE`) with clear status indicators and fallback handling.

## Phase 6: Floating Desktop Assistant
- Build separate always-on-top, draggable, resizable, collapsible Floating Overlay window.
- Implement global keyboard shortcuts (`Ctrl+Shift+Space`, `Ctrl+Enter`, `Ctrl+Shift+M`, `Ctrl+Shift+P`).
- Connect quick question input, live transcript, and streaming answers.

## Phase 7: Meeting Intelligence & Export
- Implement structured post-meeting summary, key points, decisions, action items, and questions raised.
- Implement full-text transcript search across sessions.
- Implement export to Markdown, TXT, and PDF.

## Phase 8: Testing, Hardening & Packaging
- Run Rust/Node/Python unit and integration tests.
- Verify real microphone audio, real transcription, real screen OCR, and real AI provider streaming.
- Package Windows desktop installer with `electron-builder` and verify clean launch.

## Phase 9: GitHub Publication
- Verify GitHub CLI authentication and create a new `OpenClue` repository on `main`.
- Finalize `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and `.gitignore`.
- Inspect staged diff to ensure zero secrets or local data are committed, then push.

## Future (Post-v1.0)
- macOS ScreenCaptureKit + CoreAudio loopback backend.
- Speaker diarization refinement for multi-person microphone rooms.
- Local embedding search across historical meeting transcripts.
