# Security Policy

## Local-First Privacy Model

- **Credential Storage**: Provider API keys (OpenAI, Anthropic, Google Gemini) are encrypted at rest using Electron `safeStorage` (Windows DPAPI / macOS Keychain / Linux Secret Service) and held only in memory by the local Python backend during runtime.
- **Local IPC Authentication**: The Electron main process spawns the Python FastAPI sidecar on `127.0.0.1` with a per-launch 48-character random bearer token.
- **No Telemetry**: OpenClue sends zero telemetry or analytics.
- **Screen-Sharing Privacy Mode**: Uses OS-approved `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` on Windows and `NSWindow.SharingType.none` on macOS to prevent accidental disclosure of private assistant notes during screen shares.

## Reporting a Vulnerability

Please open a private security advisory on GitHub or contact the repository maintainers directly. Do not open public issues for unpatched security vulnerabilities.
