from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx


class ProviderError(RuntimeError):
    """Raised when an AI provider fails or is misconfigured."""


async def list_ollama_models(base_url: str = "http://127.0.0.1:11434") -> list[str]:
    """Return locally available Ollama model names, or empty list if Ollama is offline."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url.rstrip('/')}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            return [m["name"] for m in data.get("models", []) if "name" in m]
    except Exception:
        return []


async def stream_llm_response(
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    system_prompt: str,
    api_key: str = "",
    ollama_base_url: str = "http://127.0.0.1:11434",
) -> AsyncIterator[str]:
    """Stream text deltas from the selected AI provider."""
    provider_norm = provider.lower().strip()
    if provider_norm == "ollama":
        async for chunk in _stream_ollama(ollama_base_url, model, system_prompt, messages):
            yield chunk
    elif provider_norm == "openai":
        if not api_key:
            raise ProviderError("OpenAI API key is not configured. Add it in Model Provider Settings.")
        async for chunk in _stream_openai(api_key, model, system_prompt, messages):
            yield chunk
    elif provider_norm == "anthropic":
        if not api_key:
            raise ProviderError("Anthropic API key is not configured. Add it in Model Provider Settings.")
        async for chunk in _stream_anthropic(api_key, model, system_prompt, messages):
            yield chunk
    elif provider_norm == "gemini":
        if not api_key:
            raise ProviderError("Google Gemini API key is not configured. Add it in Model Provider Settings.")
        async for chunk in _stream_gemini(api_key, model, system_prompt, messages):
            yield chunk
    else:
        raise ProviderError(f"Unsupported AI provider: {provider}")


async def _stream_ollama(
    base_url: str,
    model: str,
    system_prompt: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = f"{base_url.rstrip('/')}/api/chat"
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(f"Ollama error ({resp.status_code}): {body.decode(errors='ignore')}")
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if data.get("done"):
                        break
    except httpx.ConnectError as exc:
        raise ProviderError(
            f"Cannot connect to local Ollama at {base_url}. Ensure Ollama is running or select a cloud provider."
        ) from exc


async def _stream_openai(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "system", "content": system_prompt}, *messages],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise ProviderError(f"OpenAI error ({resp.status_code}): {body.decode(errors='ignore')}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                data = json.loads(raw)
                delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if delta:
                    yield delta


async def _stream_anthropic(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 2048,
        "stream": True,
        "system": system_prompt,
        "messages": messages,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise ProviderError(f"Anthropic error ({resp.status_code}): {body.decode(errors='ignore')}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = json.loads(line[6:].strip())
                if data.get("type") == "content_block_delta":
                    text = data.get("delta", {}).get("text", "")
                    if text:
                        yield text


async def _stream_gemini(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    clean_model = model.removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:streamGenerateContent?alt=sse&key={api_key}"
    contents: list[dict[str, Any]] = []
    for msg in messages:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, json=payload) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise ProviderError(f"Gemini error ({resp.status_code}): {body.decode(errors='ignore')}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = json.loads(line[6:].strip())
                candidates = data.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    text = part.get("text", "")
                    if text:
                        yield text
