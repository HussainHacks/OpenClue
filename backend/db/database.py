from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


DEFAULT_SETTINGS: dict[str, Any] = {
    "onboarding_completed": False,
    "theme": "dark",
    "ai_provider": "ollama",
    "ai_model": "llama3.2",
    "ollama_base_url": "http://127.0.0.1:11434",
    "system_instructions": (
        "You are OpenClue, a concise, accurate, and helpful real-time desktop assistant. "
        "Use the recent conversation transcript and screen context when relevant."
    ),
    "response_length": "balanced",
    "response_style": "professional",
    "professional_background": "",
    "project_context": "",
    "whisper_model": "base.en",
    "transcription_provider": "local",
    "transcription_language": "en",
    "mic_device_id": None,
    "capture_system_audio": True,
    "noise_reduction": True,
    "vad_threshold": 0.015,
    "screen_capture_enabled": False,
    "screen_capture_interval_sec": 15,
    "selected_monitor_index": 1,
    "selected_window_title": "",
    "privacy_mode_enabled": True,
    "retention_days": 30,
}


class Database:
    """Local-first SQLite persistence for OpenClue sessions, transcripts, and settings."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    session_type TEXT NOT NULL DEFAULT 'meeting',
                    custom_instructions TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    ended_at TEXT
                );

                CREATE TABLE IF NOT EXISTS transcripts (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    speaker TEXT NOT NULL,
                    text TEXT NOT NULL,
                    is_final INTEGER NOT NULL DEFAULT 1,
                    timestamp_ms INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    screen_ocr_excerpt TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS summaries (
                    session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
                    summary TEXT NOT NULL,
                    key_points_json TEXT NOT NULL,
                    decisions_json TEXT NOT NULL,
                    action_items_json TEXT NOT NULL,
                    questions_raised_json TEXT NOT NULL,
                    important_timestamps_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS reference_docs (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL
                );
                """
            )
            for key, value in DEFAULT_SETTINGS.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value_json) VALUES (?, ?)",
                    (key, json.dumps(value)),
                )

    # --- Settings ---
    def get_settings(self) -> dict[str, Any]:
        with self.connect() as conn:
            rows = conn.execute("SELECT key, value_json FROM settings").fetchall()
        result = dict(DEFAULT_SETTINGS)
        for row in rows:
            result[row["key"]] = json.loads(row["value_json"])
        return result

    def update_settings(self, patch: dict[str, Any]) -> dict[str, Any]:
        with self.connect() as conn:
            for key, value in patch.items():
                conn.execute(
                    "INSERT INTO settings (key, value_json) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
                    (key, json.dumps(value)),
                )
        return self.get_settings()

    # --- Sessions ---
    def create_session(
        self,
        title: str = "Untitled Session",
        session_type: str = "meeting",
        custom_instructions: str = "",
    ) -> dict[str, Any]:
        sid = str(uuid.uuid4())
        now = utc_now_iso()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO sessions (id, title, session_type, custom_instructions, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (sid, title, session_type, custom_instructions, now, now),
            )
        return self.get_session(sid)  # type: ignore[return-value]

    def list_sessions(self, query: str = "") -> list[dict[str, Any]]:
        with self.connect() as conn:
            if query.strip():
                like = f"%{query.strip()}%"
                rows = conn.execute(
                    """
                    SELECT DISTINCT s.*,
                        (SELECT COUNT(*) FROM transcripts t WHERE t.session_id = s.id) AS transcript_count,
                        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
                    FROM sessions s
                    LEFT JOIN transcripts t ON t.session_id = s.id
                    WHERE s.title LIKE ? OR t.text LIKE ?
                    ORDER BY s.updated_at DESC
                    """,
                    (like, like),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT s.*,
                        (SELECT COUNT(*) FROM transcripts t WHERE t.session_id = s.id) AS transcript_count,
                        (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count
                    FROM sessions s
                    ORDER BY s.updated_at DESC
                    """
                ).fetchall()
        return [dict(r) for r in rows]

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        return dict(row) if row else None

    def update_session(self, session_id: str, **fields: Any) -> dict[str, Any] | None:
        allowed = {"title", "session_type", "custom_instructions", "ended_at"}
        updates = {k: v for k, v in fields.items() if k in allowed}
        if not updates:
            return self.get_session(session_id)
        updates["updated_at"] = utc_now_iso()
        cols = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [session_id]
        with self.connect() as conn:
            conn.execute(f"UPDATE sessions SET {cols} WHERE id = ?", vals)
        return self.get_session(session_id)

    def delete_session(self, session_id: str) -> bool:
        with self.connect() as conn:
            cur = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            return cur.rowcount > 0

    def delete_all_data(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                DELETE FROM summaries;
                DELETE FROM messages;
                DELETE FROM transcripts;
                DELETE FROM sessions;
                DELETE FROM reference_docs;
                """
            )

    def enforce_retention(self, retention_days: int) -> int:
        if retention_days <= 0:
            return 0
        cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
        with self.connect() as conn:
            cur = conn.execute("DELETE FROM sessions WHERE updated_at < ?", (cutoff,))
            return cur.rowcount

    # --- Transcripts ---
    def add_transcript(
        self,
        session_id: str,
        speaker: str,
        text: str,
        timestamp_ms: int,
        is_final: bool = True,
    ) -> dict[str, Any]:
        tid = str(uuid.uuid4())
        now = utc_now_iso()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO transcripts (id, session_id, speaker, text, is_final, timestamp_ms, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (tid, session_id, speaker, text, 1 if is_final else 0, timestamp_ms, now),
            )
            conn.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id))
        return {
            "id": tid,
            "session_id": session_id,
            "speaker": speaker,
            "text": text,
            "is_final": is_final,
            "timestamp_ms": timestamp_ms,
            "created_at": now,
        }

    def get_transcripts(self, session_id: str, limit: int = 500) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM transcripts
                WHERE session_id = ?
                ORDER BY timestamp_ms ASC, created_at ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["is_final"] = bool(d["is_final"])
            result.append(d)
        return result

    def search_transcripts(self, query: str, limit: int = 50) -> list[dict[str, Any]]:
        like = f"%{query.strip()}%"
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT t.*, s.title AS session_title
                FROM transcripts t
                JOIN sessions s ON s.id = t.session_id
                WHERE t.text LIKE ?
                ORDER BY t.created_at DESC
                LIMIT ?
                """,
                (like, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    # --- Messages ---
    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        screen_ocr_excerpt: str = "",
    ) -> dict[str, Any]:
        mid = str(uuid.uuid4())
        now = utc_now_iso()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO messages (id, session_id, role, content, screen_ocr_excerpt, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (mid, session_id, role, content, screen_ocr_excerpt, now),
            )
            conn.execute("UPDATE sessions SET updated_at = ? WHERE id = ?", (now, session_id))
        return {
            "id": mid,
            "session_id": session_id,
            "role": role,
            "content": content,
            "screen_ocr_excerpt": screen_ocr_excerpt,
            "created_at": now,
        }

    def get_messages(self, session_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM messages
                WHERE session_id = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    # --- Summaries ---
    def save_summary(self, session_id: str, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO summaries (
                    session_id, summary, key_points_json, decisions_json,
                    action_items_json, questions_raised_json, important_timestamps_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    summary = excluded.summary,
                    key_points_json = excluded.key_points_json,
                    decisions_json = excluded.decisions_json,
                    action_items_json = excluded.action_items_json,
                    questions_raised_json = excluded.questions_raised_json,
                    important_timestamps_json = excluded.important_timestamps_json,
                    updated_at = excluded.updated_at
                """,
                (
                    session_id,
                    data.get("summary", ""),
                    json.dumps(data.get("key_points", [])),
                    json.dumps(data.get("decisions", [])),
                    json.dumps(data.get("action_items", [])),
                    json.dumps(data.get("questions_raised", [])),
                    json.dumps(data.get("important_timestamps", [])),
                    now,
                ),
            )
        return self.get_summary(session_id)  # type: ignore[return-value]

    def get_summary(self, session_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM summaries WHERE session_id = ?", (session_id,)).fetchone()
        if not row:
            return None
        return {
            "session_id": row["session_id"],
            "summary": row["summary"],
            "key_points": json.loads(row["key_points_json"]),
            "decisions": json.loads(row["decisions_json"]),
            "action_items": json.loads(row["action_items_json"]),
            "questions_raised": json.loads(row["questions_raised_json"]),
            "important_timestamps": json.loads(row["important_timestamps_json"]),
            "updated_at": row["updated_at"],
        }

    # --- Reference Docs ---
    def add_reference_doc(self, title: str, content: str) -> dict[str, Any]:
        did = str(uuid.uuid4())
        now = utc_now_iso()
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO reference_docs (id, title, content, created_at) VALUES (?, ?, ?, ?)",
                (did, title, content, now),
            )
        return {"id": did, "title": title, "content": content, "created_at": now}

    def list_reference_docs(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM reference_docs ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

    def delete_reference_doc(self, doc_id: str) -> bool:
        with self.connect() as conn:
            cur = conn.execute("DELETE FROM reference_docs WHERE id = ?", (doc_id,))
            return cur.rowcount > 0
