from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel

from ai import (
    ProviderError,
    build_context_messages,
    build_system_prompt,
    generate_meeting_intelligence,
    list_ollama_models,
    stream_llm_response,
)
from ai.assistant import format_ms
from audio import AudioEngine, list_audio_devices
from config import get_api_token, get_db_path
from db.database import Database
from screen import ScreenContextEngine
from transcription import TranscriptionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("openclue.api")

db = Database(get_db_path())
transcriber = TranscriptionService()
screen_engine = ScreenContextEngine()

# Runtime-only API keys passed from Electron safeStorage via request headers or in-memory sync
runtime_api_keys: dict[str, str] = {}
ws_clients: set[WebSocket] = set()
main_loop: asyncio.AbstractEventLoop | None = None
active_session_id: str | None = None


def broadcast_event(event: dict[str, Any]) -> None:
    if main_loop is None or not ws_clients:
        return
    payload = json.dumps(event)

    async def _send() -> None:
        dead: list[WebSocket] = []
        for ws in list(ws_clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_clients.discard(ws)

    asyncio.run_coroutine_threadsafe(_send(), main_loop)


def on_audio_levels(mic_level: float, system_level: float) -> None:
    broadcast_event(
        {
            "type": "audio_levels",
            "mic_level": round(mic_level, 3),
            "system_level": round(system_level, 3),
        }
    )


def on_audio_segment(speaker: str, audio_16k: np.ndarray, start_ms: int, is_final: bool) -> None:
    global active_session_id
    sid = active_session_id
    if not sid:
        return
    settings = db.get_settings()
    try:
        text = transcriber.transcribe_audio(
            audio_16k=audio_16k,
            model_name=settings.get("whisper_model", "base.en"),
            language=settings.get("transcription_language", "en"),
            provider=settings.get("transcription_provider", "local"),
            openai_api_key=runtime_api_keys.get("openai", ""),
        )
    except Exception as exc:
        logger.error("Transcription error: %s", exc)
        broadcast_event({"type": "transcription_error", "message": str(exc)})
        return

    if not text:
        return

    if is_final:
        seg = db.add_transcript(sid, speaker, text, start_ms, is_final=True)
        broadcast_event({"type": "transcript_final", "segment": seg})
    else:
        broadcast_event(
            {
                "type": "transcript_partial",
                "segment": {
                    "session_id": sid,
                    "speaker": speaker,
                    "text": text,
                    "timestamp_ms": start_ms,
                    "is_final": False,
                },
            }
        )


audio_engine = AudioEngine(on_segment=on_audio_segment, on_levels=on_audio_levels)


def verify_token(authorization: str = Header(default="")) -> None:
    expected = get_api_token()
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid API token")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    settings = db.get_settings()
    db.enforce_retention(int(settings.get("retention_days", 30)))
    yield
    audio_engine.stop()


app = FastAPI(title="OpenClue Local Backend", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---
class SessionCreate(BaseModel):
    title: str = "Untitled Session"
    session_type: str = "meeting"
    custom_instructions: str = ""


class SessionUpdate(BaseModel):
    title: str | None = None
    session_type: str | None = None
    custom_instructions: str | None = None
    ended_at: str | None = None


class AudioStartRequest(BaseModel):
    session_id: str


class AskRequest(BaseModel):
    question: str
    include_screen_context: bool = True


class ReferenceDocCreate(BaseModel):
    title: str
    content: str


class ScreenCaptureRequest(BaseModel):
    monitor_index: int = 1
    window_title: str = ""


class RuntimeKeysPayload(BaseModel):
    keys: dict[str, str]


# --- Health & Keys ---
@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "audio": audio_engine.status}


@app.post("/runtime-keys", dependencies=[Depends(verify_token)])
async def sync_runtime_keys(payload: RuntimeKeysPayload) -> dict[str, Any]:
    runtime_api_keys.clear()
    for k, v in payload.keys.items():
        if v:
            runtime_api_keys[k.lower()] = v
    return {"configured_providers": list(runtime_api_keys.keys())}


# --- Settings ---
@app.get("/settings", dependencies=[Depends(verify_token)])
async def get_settings() -> dict[str, Any]:
    return db.get_settings()


@app.patch("/settings", dependencies=[Depends(verify_token)])
async def patch_settings(patch: dict[str, Any]) -> dict[str, Any]:
    return db.update_settings(patch)


# --- Audio ---
@app.get("/audio/devices", dependencies=[Depends(verify_token)])
async def get_audio_devices() -> dict[str, Any]:
    return list_audio_devices()


@app.get("/audio/status", dependencies=[Depends(verify_token)])
async def get_audio_status() -> dict[str, Any]:
    return audio_engine.status


@app.post("/audio/start", dependencies=[Depends(verify_token)])
async def start_audio(req: AudioStartRequest) -> dict[str, Any]:
    global active_session_id
    if not db.get_session(req.session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    settings = db.get_settings()
    active_session_id = req.session_id
    try:
        audio_engine.start(
            session_id=req.session_id,
            mic_device_id=settings.get("mic_device_id"),
            capture_system_audio=bool(settings.get("capture_system_audio", True)),
            noise_reduction=bool(settings.get("noise_reduction", True)),
            vad_threshold=float(settings.get("vad_threshold", 0.015)),
        )
    except RuntimeError as exc:
        active_session_id = None
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    broadcast_event({"type": "audio_status", "status": audio_engine.status})
    return audio_engine.status


@app.post("/audio/pause", dependencies=[Depends(verify_token)])
async def pause_audio() -> dict[str, Any]:
    audio_engine.pause()
    broadcast_event({"type": "audio_status", "status": audio_engine.status})
    return audio_engine.status


@app.post("/audio/resume", dependencies=[Depends(verify_token)])
async def resume_audio() -> dict[str, Any]:
    audio_engine.resume()
    broadcast_event({"type": "audio_status", "status": audio_engine.status})
    return audio_engine.status


@app.post("/audio/stop", dependencies=[Depends(verify_token)])
async def stop_audio() -> dict[str, Any]:
    global active_session_id
    audio_engine.stop()
    active_session_id = None
    broadcast_event({"type": "audio_status", "status": audio_engine.status})
    return audio_engine.status


# --- Screen Context ---
@app.get("/screen/sources", dependencies=[Depends(verify_token)])
async def get_screen_sources() -> dict[str, Any]:
    return screen_engine.list_sources()


@app.post("/screen/capture", dependencies=[Depends(verify_token)])
async def capture_screen(req: ScreenCaptureRequest) -> dict[str, Any]:
    result = await asyncio.to_thread(screen_engine.capture_and_ocr, req.monitor_index, req.window_title)
    broadcast_event(
        {
            "type": "screen_context",
            "source_label": result["source_label"],
            "captured_at": result["captured_at"],
            "char_count": result["char_count"],
        }
    )
    return result


@app.get("/screen/latest", dependencies=[Depends(verify_token)])
async def get_latest_screen() -> dict[str, Any]:
    return {
        "ocr_text": screen_engine.latest_ocr_text,
        "source_label": screen_engine.latest_source_label,
        "captured_at": screen_engine.latest_captured_at,
        "thumbnail_b64": screen_engine.latest_thumbnail_b64,
    }


@app.post("/screen/clear", dependencies=[Depends(verify_token)])
async def clear_screen() -> dict[str, str]:
    screen_engine.clear()
    return {"status": "cleared"}


# --- Sessions & Transcripts ---
@app.get("/sessions", dependencies=[Depends(verify_token)])
async def list_sessions(q: str = Query(default="")) -> list[dict[str, Any]]:
    return db.list_sessions(q)


@app.post("/sessions", dependencies=[Depends(verify_token)])
async def create_session(payload: SessionCreate) -> dict[str, Any]:
    return db.create_session(payload.title, payload.session_type, payload.custom_instructions)


@app.get("/sessions/{session_id}", dependencies=[Depends(verify_token)])
async def get_session(session_id: str) -> dict[str, Any]:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session": session,
        "transcripts": db.get_transcripts(session_id),
        "messages": db.get_messages(session_id),
        "summary": db.get_summary(session_id),
    }


@app.patch("/sessions/{session_id}", dependencies=[Depends(verify_token)])
async def update_session(session_id: str, payload: SessionUpdate) -> dict[str, Any]:
    updated = db.update_session(session_id, **{k: v for k, v in payload.model_dump().items() if v is not None})
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return updated


@app.delete("/sessions/{session_id}", dependencies=[Depends(verify_token)])
async def delete_session(session_id: str) -> dict[str, bool]:
    if not db.delete_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True}


@app.get("/search", dependencies=[Depends(verify_token)])
async def search(q: str = Query(min_length=1)) -> list[dict[str, Any]]:
    return db.search_transcripts(q)


# --- AI Assistant Streaming ---
@app.post("/sessions/{session_id}/ask", dependencies=[Depends(verify_token)])
async def ask_assistant(session_id: str, req: AskRequest) -> StreamingResponse:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    settings = db.get_settings()
    transcripts = db.get_transcripts(session_id)
    history = db.get_messages(session_id)
    ref_docs = db.list_reference_docs()

    ocr_text = screen_engine.latest_ocr_text if (req.include_screen_context and settings.get("screen_capture_enabled")) else ""
    db.add_message(session_id, "user", req.question, screen_ocr_excerpt=ocr_text[:500])

    system_prompt = build_system_prompt(settings, session, ref_docs)
    messages = build_context_messages(transcripts, ocr_text, history, req.question)

    provider = settings.get("ai_provider", "ollama")
    model = settings.get("ai_model", "llama3.2")
    api_key = runtime_api_keys.get(provider.lower(), "")
    ollama_url = settings.get("ollama_base_url", "http://127.0.0.1:11434")

    async def event_stream():
        full_reply: list[str] = []
        try:
            async for delta in stream_llm_response(
                provider=provider,
                model=model,
                messages=messages,
                system_prompt=system_prompt,
                api_key=api_key,
                ollama_base_url=ollama_url,
            ):
                full_reply.append(delta)
                yield f"data: {json.dumps({'delta': delta})}\n\n"
            assistant_text = "".join(full_reply)
            if assistant_text:
                db.add_message(session_id, "assistant", assistant_text)
            yield f"data: {json.dumps({'done': True})}\n\n"
        except ProviderError as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': f'Unexpected AI error: {exc}'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# --- Meeting Intelligence & Export ---
@app.post("/sessions/{session_id}/summary", dependencies=[Depends(verify_token)])
async def generate_summary(session_id: str) -> dict[str, Any]:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    settings = db.get_settings()
    transcripts = db.get_transcripts(session_id)
    provider = settings.get("ai_provider", "ollama")
    api_key = runtime_api_keys.get(provider.lower(), "")
    data = await generate_meeting_intelligence(settings, transcripts, api_key=api_key)
    return db.save_summary(session_id, data)


@app.get("/sessions/{session_id}/export", dependencies=[Depends(verify_token)])
async def export_session(session_id: str, fmt: str = Query(default="md")) -> PlainTextResponse:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    transcripts = db.get_transcripts(session_id)
    messages = db.get_messages(session_id)
    summary = db.get_summary(session_id)

    lines: list[str] = []
    if fmt == "txt":
        lines.append(f"OPENCLUE SESSION: {session['title']}")
        lines.append(f"Created: {session['created_at']}")
        lines.append("=" * 60)
        if summary:
            lines.append("\nSUMMARY\n" + summary["summary"])
            if summary["action_items"]:
                lines.append("\nACTION ITEMS\n" + "\n".join(f"- {a}" for a in summary["action_items"]))
        lines.append("\nTRANSCRIPT")
        for t in transcripts:
            lines.append(f"[{format_ms(t['timestamp_ms'])}] {t['speaker']}: {t['text']}")
        lines.append("\nASSISTANT Q&A")
        for m in messages:
            lines.append(f"{m['role'].upper()}: {m['content']}")
        return PlainTextResponse("\n".join(lines), media_type="text/plain")

    # Markdown default
    lines.append(f"# {session['title']}\n")
    lines.append(f"- **Type:** {session['session_type']}")
    lines.append(f"- **Created:** {session['created_at']}\n")
    if summary:
        lines.append("## Summary\n" + summary["summary"] + "\n")
        if summary["key_points"]:
            lines.append("## Key Discussion Points\n" + "\n".join(f"- {p}" for p in summary["key_points"]) + "\n")
        if summary["decisions"]:
            lines.append("## Decisions\n" + "\n".join(f"- {d}" for d in summary["decisions"]) + "\n")
        if summary["action_items"]:
            lines.append("## Action Items\n" + "\n".join(f"- [ ] {a}" for a in summary["action_items"]) + "\n")
        if summary["questions_raised"]:
            lines.append("## Questions Raised\n" + "\n".join(f"- {q}" for q in summary["questions_raised"]) + "\n")
    lines.append("## Transcript\n")
    for t in transcripts:
        lines.append(f"- **`[{format_ms(t['timestamp_ms'])}]` {t['speaker']}:** {t['text']}")
    if messages:
        lines.append("\n## AI Assistant Q&A\n")
        for m in messages:
            lines.append(f"**{m['role'].title()}:** {m['content']}\n")
    return PlainTextResponse("\n".join(lines), media_type="text/markdown")


# --- Reference Docs ---
@app.get("/reference-docs", dependencies=[Depends(verify_token)])
async def list_reference_docs() -> list[dict[str, Any]]:
    return db.list_reference_docs()


@app.post("/reference-docs", dependencies=[Depends(verify_token)])
async def add_reference_doc(payload: ReferenceDocCreate) -> dict[str, Any]:
    return db.add_reference_doc(payload.title, payload.content)


@app.delete("/reference-docs/{doc_id}", dependencies=[Depends(verify_token)])
async def delete_reference_doc(doc_id: str) -> dict[str, bool]:
    return {"deleted": db.delete_reference_doc(doc_id)}


# --- AI Discovery & Data Deletion ---
@app.get("/ai/ollama/models", dependencies=[Depends(verify_token)])
async def ollama_models() -> dict[str, Any]:
    settings = db.get_settings()
    models = await list_ollama_models(settings.get("ollama_base_url", "http://127.0.0.1:11434"))
    return {"models": models, "available": len(models) > 0}


@app.delete("/data/all", dependencies=[Depends(verify_token)])
async def delete_all_data() -> dict[str, str]:
    audio_engine.stop()
    screen_engine.clear()
    db.delete_all_data()
    return {"status": "deleted"}


# --- WebSocket ---
@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    expected = get_api_token()
    if expected:
        token = websocket.query_params.get("token", "")
        if token != expected:
            await websocket.close(code=1008)
            return
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        await websocket.send_text(json.dumps({"type": "audio_status", "status": audio_engine.status}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_clients.discard(websocket)
    except Exception:
        ws_clients.discard(websocket)


if __name__ == "__main__":
    import os

    port = int(os.environ.get("OPENCLUE_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
