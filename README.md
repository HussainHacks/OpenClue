# OpenClue

**OpenClue** is a source-available, local-first desktop AI assistant for live meetings, technical interviews, presentations, and research sessions.

Built with **Electron, React, TypeScript, Tailwind CSS**, and a local **Python FastAPI** AI & media engine, OpenClue captures your microphone and system audio, transcribes in real time with **Faster-Whisper**, reads your selected screen or window via **RapidOCR** when explicitly enabled, and streams context-aware answers from **Ollama (local)**, **OpenAI**, **Anthropic**, or **Google Gemini**.

## Key Features

- **Real-Time Audio & Transcription**:
  - Microphone selection (`sounddevice`) + Windows WASAPI system audio loopback (`pyaudiowpatch`).
  - Live audio level meters, energy-based VAD, noise gate, pause/resume, and speaker attribution (`You` vs `System`).
  - Local `faster-whisper` CPU inference with partial & final timestamped transcripts.
- **Explicit Screen Context (OCR)**:
  - Disabled by default; enabled only by user permission.
  - Monitor and Win32 window selection with on-demand or interval capture via `mss` + `rapidocr-onnxruntime`.
- **Screen-Sharing Privacy Mode**:
  - Keeps private assistant notes in a separate Floating Overlay window excluded from meeting screen shares via OS-approved `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows (`setContentProtection`), with clear status indicators.
- **Floating Desktop Assistant**:
  - Always-on-top, draggable, resizable, collapsible overlay with global shortcuts (`Ctrl+Shift+Space`, `Ctrl+Enter`, `Ctrl+Shift+M`, `Ctrl+Shift+P`).
- **Context-Aware AI & Meeting Intelligence**:
  - Combines live transcript, screen OCR, custom instructions, professional background, reference documents, and chat history.
  - Generates structured summaries, key discussion points, decisions, action items, and questions raised.
  - Exports sessions to **Markdown**, **TXT**, and **PDF**.
- **Privacy-First Storage**:
  - Local SQLite database, OS-encrypted API key vault (`safeStorage` / Windows DPAPI), configurable retention, and one-click data deletion.

## Installation & Platform Setup

### Prerequisites
- **Windows 10 (2004+) / Windows 11**, **macOS 12+**, or **Linux (Ubuntu/Debian)**
- **Node.js 22+**
- **uv** (`https://docs.astral.sh/uv/`) — manages Python 3.12 automatically
- *(Optional for local LLM)* **Ollama** (`https://ollama.com`)

### Windows

```powershell
git clone https://github.com/HussainHacks/OpenClue.git
cd OpenClue

npm install
cd backend && uv sync --python 3.12 && cd ..
```

### macOS

`sounddevice` requires PortAudio, and system audio capture requires a virtual loopback device such as BlackHole:

```bash
brew install portaudio
# Optional: for system audio capture (macOS has no built-in loopback)
brew install --cask blackhole-2ch

git clone https://github.com/HussainHacks/OpenClue.git
cd OpenClue

npm install
cd backend && uv sync --python 3.12 && cd ..
```

### Linux (Debian / Ubuntu)

`sounddevice` requires `libportaudio2` (and `wmctrl` or `xprop` for optional X11 window listing):

```bash
sudo apt update && sudo apt install -y libportaudio2 wmctrl

git clone https://github.com/HussainHacks/OpenClue.git
cd OpenClue

npm install
cd backend && uv sync --python 3.12 && cd ..
```

> **Platform Notes:**
> - **macOS System Audio:** macOS does not provide built-in system audio loopback; install **BlackHole** and route output through a Multi-Output Device if you want to capture system audio alongside your microphone.
> - **Linux Screen-Sharing Privacy Mode:** OS-level capture exclusion (`setContentProtection`) is not supported on Linux and is reported as **Unsupported** in the UI. Keep private assistant notes in the separate Floating Overlay window and share only your target application window.
> - **Linux Window Listing:** Uses `wmctrl` or `xprop` on X11; under pure Wayland or when those tools are absent, OpenClue falls back to monitor capture.

### Development

Terminal 1 (Vite UI):
```powershell
npm run dev
```

Terminal 2 (Build Electron & Launch):
```powershell
npm run build:electron
npx electron .
```

### Production Build & Packaging

```powershell
npm run build
npm run package:win    # Windows NSIS installer & portable .exe
npm run package:mac    # macOS DMG (x64 & arm64)
npm run package:linux  # Linux AppImage (x64)
```

Installers and portable executables are generated in `release/`.

## Testing

```powershell
# Frontend component tests
npm run test:ui

# Backend unit & hardware/OCR/API tests
cd backend
uv run pytest -v
```

## Architecture & Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System topology and component responsibilities.
- [TECHNICAL_DECISIONS.md](TECHNICAL_DECISIONS.md) — Engineering rationale for Electron, Faster-Whisper, WASAPI loopback, and RapidOCR.
- [LICENSE_AUDIT.md](LICENSE_AUDIT.md) — Dependency and model license inventory.
- [ROADMAP.md](ROADMAP.md) — Completed phases and future milestones.
- [SECURITY.md](SECURITY.md) — Local-first privacy and credential encryption details.
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines.

## License

OpenClue is source available under the [Business Source License 1.1](LICENSE), licensor Syed Ahmed Hussain. It is free for personal and other non-commercial use; commercial use requires a separate license from the licensor. Each version converts to the Apache License, Version 2.0, on its change date (version 1.0.0: November 24, 2030).
