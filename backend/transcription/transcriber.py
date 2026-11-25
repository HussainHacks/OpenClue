from __future__ import annotations

import io
import logging
import threading
import wave
from typing import Any

import httpx
import numpy as np

logger = logging.getLogger("openclue.transcription")


class TranscriptionService:
    """Real-time local (faster-whisper) and optional cloud Whisper transcription service."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model_name: str | None = None
        self._model: Any = None

    def _get_local_model(self, model_name: str) -> Any:
        from faster_whisper import WhisperModel  # type: ignore

        with self._lock:
            if self._model is None or self._model_name != model_name:
                logger.info("Loading faster-whisper model '%s' (int8 CPU)...", model_name)
                self._model = WhisperModel(model_name, device="cpu", compute_type="int8")
                self._model_name = model_name
            return self._model

    def transcribe_audio(
        self,
        audio_16k: np.ndarray,
        model_name: str = "base.en",
        language: str = "en",
        provider: str = "local",
        openai_api_key: str = "",
    ) -> str:
        """Transcribe a 16 kHz mono float32 numpy array into text."""
        if audio_16k.size < 3200:  # < 0.2s
            return ""

        if provider == "openai" and openai_api_key:
            try:
                return self._transcribe_openai(audio_16k, language, openai_api_key)
            except Exception as exc:
                logger.warning("Cloud transcription failed, falling back to local: %s", exc)

        return self._transcribe_local(audio_16k, model_name, language)

    def _transcribe_local(self, audio_16k: np.ndarray, model_name: str, language: str) -> str:
        model = self._get_local_model(model_name)
        lang_arg = None if language in ("auto", "") else language
        with self._lock:
            segments, _info = model.transcribe(
                audio_16k,
                language=lang_arg,
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            parts: list[str] = []
            for seg in segments:
                if getattr(seg, "no_speech_prob", 0.0) > 0.78:
                    continue
                txt = seg.text.strip()
                if txt:
                    parts.append(txt)
        return " ".join(parts).strip()

    def _transcribe_openai(self, audio_16k: np.ndarray, language: str, api_key: str) -> str:
        pcm16 = (np.clip(audio_16k, -1.0, 1.0) * 32767.0).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(pcm16.tobytes())
        buf.seek(0)

        data: dict[str, str] = {"model": "whisper-1"}
        if language and language != "auto":
            data["language"] = language

        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                data=data,
                files={"file": ("chunk.wav", buf.read(), "audio/wav")},
            )
            resp.raise_for_status()
            return str(resp.json().get("text", "")).strip()
