# Changelog

## [Unreleased]
### Added
- Cross-platform support for **macOS** and **Linux** alongside Windows:
  - Platform-gated `pyaudiowpatch` (`win32`) and `pyobjc-framework-Quartz` (`darwin`) dependencies in `backend/pyproject.toml`.
  - Cross-platform Python `.venv` resolution (`Scripts/python.exe` vs `bin/python`) in `electron/main.ts`.
  - Linux PulseAudio/PipeWire `monitor` source detection and macOS BlackHole loopback detection (with clear unavailable reason when absent).
  - macOS Quartz and Linux `wmctrl`/`xprop` window enumeration with monitor-only fallback.
  - Accurate platform privacy mode reporting (unsupported on Linux) and OS-native data directories (`APPDATA`, `~/Library/Application Support`, `$XDG_DATA_HOME` / `~/.local/share`).
  - `package:mac` (DMG x64/arm64) and `package:linux` (AppImage x64) build scripts and setup documentation.

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
