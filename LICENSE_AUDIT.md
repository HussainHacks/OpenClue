# License Audit

OpenClue is distributed under the **MIT License**. Every runtime dependency has been audited for permissive license compatibility.

## Desktop & Frontend Dependencies (Node.js / npm)

| Package | Purpose | License | Compatible with MIT |
| --- | --- | --- | --- |
| `electron` | Desktop shell, IPC, `safeStorage`, `setContentProtection` | MIT | Yes |
| `react`, `react-dom` | UI framework | MIT | Yes |
| `lucide-react` | Iconography | ISC | Yes |
| `tailwindcss` | Styling | MIT | Yes |
| `vite` | Frontend bundler | MIT | Yes |
| `typescript` | Static typing | Apache-2.0 | Yes |
| `zustand` | Client state management | MIT | Yes |
| `electron-builder` | Windows packaging (devDependency) | MIT | Yes |
| `vitest` | Frontend unit testing (devDependency) | MIT | Yes |

## Backend & AI Dependencies (Python / uv)

| Package | Purpose | License | Compatible with MIT |
| --- | --- | --- | --- |
| `fastapi` | Local REST & WebSocket API | MIT | Yes |
| `uvicorn` | ASGI server | BSD-3-Clause | Yes |
| `pydantic` | Request/response validation | MIT | Yes |
| `httpx` | Async HTTP client for LLM streaming | BSD-3-Clause | Yes |
| `numpy` | Audio buffer & RMS/VAD math | BSD-3-Clause | Yes |
| `sounddevice` | Microphone capture (PortAudio) | MIT | Yes |
| `pyaudiowpatch` | Windows WASAPI loopback capture | MIT | Yes |
| `faster-whisper` | Local Whisper inference | MIT | Yes |
| `ctranslate2` | Fast CPU/GPU inference engine | MIT | Yes |
| `mss` | Fast cross-platform screen capture | MIT | Yes |
| `pillow` | Image cropping/resizing | HPND (MIT-like) | Yes |
| `rapidocr-onnxruntime` | Local CPU OCR | Apache-2.0 | Yes |
| `onnxruntime` | ONNX model execution | MIT | Yes |
| `pytest` | Backend test suite (devDependency) | MIT | Yes |

## AI & Transcription Models (User-Downloaded / Configurable)

| Model | License | Notes |
| --- | --- | --- |
| OpenAI Whisper (`tiny`, `base`, `small`, `medium`) | MIT | Downloaded locally on demand by `faster-whisper` |
| RapidOCR PP-OCRv4 ONNX models | Apache-2.0 | Bundled with `rapidocr-onnxruntime` |
| Ollama local models (e.g., Llama 3.2, Qwen 2.5, Mistral) | Model-specific (Apache-2.0 / Llama Community) | User-installed via Ollama; not redistributed by OpenClue |

## Excluded Dependencies
- `fpdf2` (LGPL-3.0-or-later) and `PyMuPDF` (AGPL-3.0) were intentionally excluded to keep the distribution 100% permissively licensed. PDF export is handled natively via Electron's `printToPDF` (Chromium / BSD-3-Clause).
