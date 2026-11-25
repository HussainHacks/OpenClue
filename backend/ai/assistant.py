from __future__ import annotations

import json
import re
from typing import Any

from .providers import ProviderError, stream_llm_response


def format_ms(ms: int) -> str:
    total_sec = max(0, ms // 1000)
    minutes = total_sec // 60
    seconds = total_sec % 60
    return f"{minutes:02d}:{seconds:02d}"


def build_system_prompt(
    settings: dict[str, Any],
    session: dict[str, Any] | None = None,
    reference_docs: list[dict[str, Any]] | None = None,
) -> str:
    parts = [settings.get("system_instructions", "You are OpenClue, a helpful desktop AI assistant.")]

    length_map = {
        "concise": "Keep responses very brief, scannable, and under 4 bullet points unless asked for more.",
        "balanced": "Provide clear, well-structured answers with moderate detail.",
        "detailed": "Provide thorough, comprehensive explanations with examples when helpful.",
    }
    style = settings.get("response_style", "professional")
    length = settings.get("response_length", "balanced")
    parts.append(f"Tone: {style}. {length_map.get(length, '')}")

    if settings.get("professional_background"):
        parts.append(f"User Background:\n{settings['professional_background']}")
    if settings.get("project_context"):
        parts.append(f"Project Context:\n{settings['project_context']}")
    if session and session.get("custom_instructions"):
        parts.append(f"Session-Specific Instructions:\n{session['custom_instructions']}")

    if reference_docs:
        doc_blocks = []
        for doc in reference_docs[:5]:
            snippet = doc["content"][:2500]
            doc_blocks.append(f"### {doc['title']}\n{snippet}")
        parts.append("Reference Documents:\n" + "\n\n".join(doc_blocks))

    return "\n\n".join(p for p in parts if p.strip())


def build_context_messages(
    transcripts: list[dict[str, Any]],
    screen_ocr: str,
    history: list[dict[str, Any]],
    question: str,
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []

    # Include recent chat history (last 8 turns)
    for msg in history[-8:]:
        role = msg["role"] if msg["role"] in ("user", "assistant") else "user"
        messages.append({"role": role, "content": msg["content"]})

    context_sections: list[str] = []
    if transcripts:
        recent = transcripts[-35:]
        lines = [f"[{format_ms(t['timestamp_ms'])}] {t['speaker']}: {t['text']}" for t in recent]
        context_sections.append("Recent Conversation Transcript:\n" + "\n".join(lines))

    if screen_ocr.strip():
        context_sections.append("Visible Screen Context (OCR):\n" + screen_ocr.strip()[:4000])

    if context_sections:
        user_payload = "\n\n".join(context_sections) + f"\n\nUser Question:\n{question}"
    else:
        user_payload = question

    messages.append({"role": "user", "content": user_payload})
    return messages


async def generate_meeting_intelligence(
    settings: dict[str, Any],
    transcripts: list[dict[str, Any]],
    api_key: str = "",
) -> dict[str, Any]:
    """Generate structured meeting intelligence using the configured LLM, with local fallback."""
    if not transcripts:
        return {
            "summary": "No transcript segments recorded yet for this session.",
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "questions_raised": [],
            "important_timestamps": [],
        }

    transcript_text = "\n".join(
        f"[{format_ms(t['timestamp_ms'])}] {t['speaker']}: {t['text']}" for t in transcripts
    )[:12000]

    prompt = (
        "Analyze the following meeting transcript and return ONLY valid JSON with these exact keys:\n"
        '{"summary": string, "key_points": string[], "decisions": string[], '
        '"action_items": string[], "questions_raised": string[], "important_timestamps": string[]}\n\n'
        f"Transcript:\n{transcript_text}"
    )

    try:
        chunks: list[str] = []
        async for delta in stream_llm_response(
            provider=settings.get("ai_provider", "ollama"),
            model=settings.get("ai_model", "llama3.2"),
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a precise meeting analyst. Output strictly valid JSON.",
            api_key=api_key,
            ollama_base_url=settings.get("ollama_base_url", "http://127.0.0.1:11434"),
        ):
            chunks.append(delta)
        raw = "".join(chunks).strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            return {
                "summary": str(parsed.get("summary", "")),
                "key_points": list(parsed.get("key_points", [])),
                "decisions": list(parsed.get("decisions", [])),
                "action_items": list(parsed.get("action_items", [])),
                "questions_raised": list(parsed.get("questions_raised", [])),
                "important_timestamps": list(parsed.get("important_timestamps", [])),
            }
    except (ProviderError, json.JSONDecodeError, Exception):
        pass

    # Deterministic fallback if AI provider is offline or returned non-JSON
    questions = [
        f"[{format_ms(t['timestamp_ms'])}] {t['text']}"
        for t in transcripts
        if "?" in t["text"]
    ][:8]
    actions = [
        f"[{format_ms(t['timestamp_ms'])}] {t['text']}"
        for t in transcripts
        if any(kw in t["text"].lower() for kw in ("will ", "todo", "action", "follow up", "send ", "schedule "))
    ][:8]
    return {
        "summary": f"Session recorded {len(transcripts)} transcript segments. Configure an active AI provider to generate an abstractive summary.",
        "key_points": [f"[{format_ms(t['timestamp_ms'])}] {t['speaker']}: {t['text']}" for t in transcripts[:5]],
        "decisions": [],
        "action_items": actions,
        "questions_raised": questions,
        "important_timestamps": [f"[{format_ms(t['timestamp_ms'])}] {t['speaker']}" for t in transcripts[::max(1, len(transcripts)//5)]],
    }
