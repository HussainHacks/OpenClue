# Changelog

## [1.0.0] - 2026-11-24
### Added
- Dual-window Electron + React + TypeScript desktop application (Main Workspace + Floating Assistant Overlay).
- Real-time microphone capture (`sounddevice`) and Windows WASAPI system audio loopback (`pyaudiowpatch`) with VAD, noise gate, pause/resume, and live level meters.
- Local Faster-Whisper transcription (`tiny.en`, `base.en`, `small.en`, `base`, `small`) with partial and final timestamped segments, plus optional OpenAI Whisper API fallback.
- Explicit monitor and Win32 window selection with local RapidOCR text extraction.
- OS-approved Screen-Sharing Privacy Mode (`WDA_EXCLUDEFROMCAPTURE` on Windows) with clear status indicators and safe fallback.
- Streaming AI Assistant supporting local Ollama, OpenAI, Anthropic, and Google Gemini.
- Meeting Intelligence generator (summary, key points, decisions, action items, questions raised) and Markdown, TXT, and PDF export.
- Local SQLite persistence, full-text search, retention controls, DPAPI API key vault, and one-click data deletion.
