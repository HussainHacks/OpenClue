# Contributing to OpenClue

Thank you for contributing to OpenClue!

## Development Setup

1. Install **Node.js 22+** and **uv** (Python package manager).
2. Install frontend & Electron dependencies:
   ```bash
   npm install
   ```
3. Install Python backend dependencies:
   ```bash
   cd backend
   uv sync --python 3.12
   ```
4. Run tests before submitting a pull request:
   ```bash
   npm run test:ui
   cd backend && uv run pytest -v
   ```

## Guidelines

- Keep all capture states (microphone, system audio, screen OCR, screen-sharing privacy mode) transparent and user-controlled.
- Do not add stealth or anti-proctoring features.
- Do not introduce copyleft dependencies incompatible with the MIT license.
- Never commit API keys, `.env` files, or local SQLite databases.
