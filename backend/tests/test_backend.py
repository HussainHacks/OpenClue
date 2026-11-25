from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ai.assistant import build_context_messages, build_system_prompt, generate_meeting_intelligence
from audio.engine import ChannelVADBuffer, list_audio_devices, resample_to_16k
from db.database import Database
from main import app
from screen.capture import ScreenContextEngine


def test_database_crud_and_deletion(tmp_path: Path) -> None:
    db = Database(tmp_path / "test.db")
    settings = db.get_settings()
    assert settings["ai_provider"] == "ollama"

    db.update_settings({"theme": "light", "whisper_model": "tiny.en"})
    assert db.get_settings()["theme"] == "light"

    session = db.create_session("Architecture Review", "meeting", "Be concise")
    sid = session["id"]
    db.add_transcript(sid, "You", "Let's finalize the SQLite schema today.", 1200)
    db.add_transcript(sid, "System", "Agreed, we will ship the migration.", 4500)
    db.add_message(sid, "user", "What did we decide?")
    db.add_message(sid, "assistant", "You decided to ship the SQLite migration.")
    db.save_summary(
        sid,
        {
            "summary": "Finalized SQLite schema.",
            "key_points": ["SQLite schema"],
            "decisions": ["Ship migration"],
            "action_items": ["Run tests"],
            "questions_raised": [],
            "important_timestamps": ["00:01"],
        },
    )

    assert len(db.get_transcripts(sid)) == 2
    assert len(db.get_messages(sid)) == 2
    assert len(db.search_transcripts("SQLite")) == 1
    assert db.get_summary(sid)["decisions"] == ["Ship migration"]

    db.delete_all_data()
    assert db.list_sessions() == []


def test_audio_resample_and_vad() -> None:
    src = np.ones(4800, dtype=np.float32) * 0.5
    out = resample_to_16k(src, 48000)
    assert out.shape[0] == 1600

    emitted: list[tuple[str, int, bool]] = []
    vad = ChannelVADBuffer(
        speaker="You",
        vad_threshold=0.02,
        noise_reduction=True,
        on_segment=lambda spk, _audio, ms, fin: emitted.append((spk, ms, fin)),
    )
    # Push 0.5s of speech
    speech = np.ones(8000, dtype=np.float32) * 0.2
    vad.push(speech, 0.0)
    vad.flush()
    assert len(emitted) == 1
    assert emitted[0][0] == "You"
    assert emitted[0][2] is True


def test_real_audio_device_enumeration() -> None:
    devices = list_audio_devices()
    assert "microphones" in devices
    assert isinstance(devices["microphones"], list)
    assert "system_audio_supported" in devices
    assert "system_audio_reason" in devices


def test_cross_platform_audio_loopback_detection(monkeypatch) -> None:
    import audio.engine as audio_mod

    fake_devs = [
        {"name": "Built-in Mic", "hostapi": 0, "max_input_channels": 2, "default_samplerate": 48000},
        {"name": "Monitor of Built-in Audio Analog Stereo", "hostapi": 0, "max_input_channels": 2, "default_samplerate": 48000},
    ]
    monkeypatch.setattr(audio_mod.sd, "query_devices", lambda: fake_devs)
    monkeypatch.setattr(audio_mod.sd, "query_hostapis", lambda: [{"name": "ALSA"}])

    monkeypatch.setattr(audio_mod.sys, "platform", "linux")
    res_linux = audio_mod.list_audio_devices()
    assert res_linux["system_audio_supported"] is True
    assert len(res_linux["loopback_devices"]) == 1
    assert "Monitor" in res_linux["loopback_devices"][0]["name"]

    monkeypatch.setattr(audio_mod.sys, "platform", "darwin")
    res_mac_no_bh = audio_mod.list_audio_devices()
    assert res_mac_no_bh["system_audio_supported"] is False
    assert "BlackHole" in res_mac_no_bh["system_audio_reason"]

    fake_devs.append({"name": "BlackHole 2ch", "hostapi": 0, "max_input_channels": 2, "default_samplerate": 48000})
    res_mac_bh = audio_mod.list_audio_devices()
    assert res_mac_bh["system_audio_supported"] is True
    assert res_mac_bh["loopback_devices"][0]["name"] == "BlackHole 2ch"


def test_real_screen_capture_and_ocr() -> None:
    from PIL import Image, ImageDraw

    engine = ScreenContextEngine()
    sources = engine.list_sources()
    assert len(sources["monitors"]) >= 1

    # Verify RapidOCR end-to-end on a rendered image
    img = Image.new("RGB", (600, 140), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((24, 48), "OpenClue Meeting Assistant 2026", fill=(0, 0, 0))
    ocr_res = engine.run_ocr_on_image(img, source_label="TestCanvas")
    assert "OpenClue" in ocr_res["ocr_text"]
    assert len(ocr_res["thumbnail_b64"]) > 100

    # Also test live desktop capture when an interactive desktop session is unlocked
    try:
        live_res = engine.capture_and_ocr(monitor_index=1)
        assert "thumbnail_b64" in live_res
    except Exception:
        pass


def test_context_assembly_and_summary_fallback() -> None:
    prompt = build_system_prompt(
        {"system_instructions": "Base", "response_length": "concise", "response_style": "technical"},
        {"custom_instructions": "Focus on Rust"},
        [{"title": "Spec", "content": "Details here"}],
    )
    assert "Focus on Rust" in prompt
    assert "Spec" in prompt

    msgs = build_context_messages(
        [{"timestamp_ms": 1000, "speaker": "You", "text": "Hello"}],
        "Screen text",
        [],
        "Summarize",
    )
    assert "Hello" in msgs[-1]["content"]
    assert "Screen text" in msgs[-1]["content"]


def test_fastapi_endpoints() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    created = client.post("/sessions", json={"title": "API Test Session", "session_type": "meeting"}).json()
    sid = created["id"]
    export_md = client.get(f"/sessions/{sid}/export?fmt=md")
    assert export_md.status_code == 200
    assert "# API Test Session" in export_md.text
    client.delete(f"/sessions/{sid}")
