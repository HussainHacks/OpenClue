from __future__ import annotations

import os
from pathlib import Path


def get_data_dir() -> Path:
    """Return the local user data directory for OpenClue."""
    custom = os.environ.get("OPENCLUE_DATA_DIR")
    if custom:
        path = Path(custom)
    else:
        appdata = os.environ.get("APPDATA") or str(Path.home() / ".local" / "share")
        path = Path(appdata) / "OpenClue"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_db_path() -> Path:
    """Return the SQLite database path."""
    return get_data_dir() / "openclue.db"


def get_api_token() -> str:
    """Return the per-launch local IPC bearer token (empty in standalone dev)."""
    return os.environ.get("OPENCLUE_API_TOKEN", "")
