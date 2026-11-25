# Technical Decisions

## TD-01: Electron + Python FastAPI Sidecar vs. Tauri 2 + Rust
- **Context**: Tauri 2 requires Rust (`rustc`/`cargo`) and Microsoft C++ Build Tools (MSVC + Windows SDK). Inspection of the target Windows build environment showed Node.js v22.23.2, `uv` 0.12.9 (Python 3.12), and WebView2 are available, while Rust and MSVC Build Tools are not installed.
- **Decision**: Use **Electron** (with React, TypeScript, Vite, Tailwind CSS) for the desktop shell and **Python 3.12** (`uv`-managed FastAPI + WebSockets) for audio, local Whisper transcription, OCR, and AI orchestration.
- **Rationale**:
  1. Builds, tests, and packages natively on Windows via `electron-builder` with zero C++ compiler toolchain dependencies.
  2. Provides native `BrowserWindow.setContentProtection(true)` (Win32 `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`), `safeStorage` (Windows DPAPI), `globalShortcut`, and multi-window management out of the box.
  3. Python has mature, permissive-licensed bindings for `faster-whisper`, `pyaudiowpatch` (WASAPI loopback), `sounddevice`, and `rapidocr-onnxruntime`.

## TD-02: Local Transcription via `faster-whisper` (CTranslate2)
- **Decision**: Use `faster-whisper` with `int8` quantization on CPU by default (`tiny.en` / `base` / `small`), plus optional user-configured cloud transcription.
- **Rationale**: Runs locally on standard laptops without a dedicated NVIDIA GPU, uses 4x less memory than PyTorch Whisper, and is MIT-licensed.

## TD-03: System Audio via Windows WASAPI Loopback (`pyaudiowpatch`)
- **Decision**: Abstract audio capture behind an `AudioCaptureBackend` interface; implement Windows WASAPI loopback via `pyaudiowpatch` alongside PortAudio microphone capture via `sounddevice`.
- **Rationale**: Allows capturing Zoom/Teams/Meet/browser audio directly from the default output device without requiring third-party virtual audio cables (like VB-Cable). Cleanly separates Windows-specific code so macOS ScreenCaptureKit can be added later.

## TD-04: Local OCR via `rapidocr-onnxruntime`
- **Decision**: Use `rapidocr-onnxruntime` instead of requiring an external Tesseract binary installation.
- **Rationale**: Self-contained Python package (Apache-2.0 / MIT), fast CPU inference via ONNX Runtime, and zero manual binary setup for end users on Windows.

## TD-05: Credential Storage via Electron `safeStorage`
- **Decision**: Encrypt all API keys (OpenAI, Anthropic, Gemini) using Electron's `safeStorage.encryptString()` (backed by Windows DPAPI) and store only encrypted ciphertext in the user's app data directory.
- **Rationale**: Avoids plaintext `.env` files or unencrypted SQLite columns for sensitive credentials.

## TD-06: PDF Export via Electron `printToPDF`
- **Decision**: Render formatted HTML meeting reports in a hidden Electron `BrowserWindow` and export via `webContents.printToPDF()`.
- **Rationale**: Produces crisp, styled PDFs with zero copyleft (LGPL/GPL) Python PDF library dependencies, preserving strict MIT license compatibility.
