from __future__ import annotations

import logging
import queue
import sys
import threading
import time
from typing import Any, Callable, Protocol

import numpy as np
import sounddevice as sd

logger = logging.getLogger("openclue.audio")

TARGET_SAMPLE_RATE = 16000


def resample_to_16k(audio: np.ndarray, src_rate: int) -> np.ndarray:
    """Resample 1D float32 audio to 16 kHz mono."""
    if src_rate == TARGET_SAMPLE_RATE or audio.size == 0:
        return audio.astype(np.float32, copy=False)
    duration = audio.shape[0] / float(src_rate)
    target_len = max(1, int(round(duration * TARGET_SAMPLE_RATE)))
    x_old = np.linspace(0.0, 1.0, num=audio.shape[0], endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=target_len, endpoint=False)
    return np.interp(x_new, x_old, audio).astype(np.float32)


def list_audio_devices() -> dict[str, Any]:
    """Enumerate available microphone input devices and Windows WASAPI loopback devices."""
    microphones: list[dict[str, Any]] = []
    default_mic: int | None = None
    try:
        default_in = sd.default.device[0]
        if isinstance(default_in, int) and default_in >= 0:
            default_mic = default_in
        devices = sd.query_devices()
        hostapis = sd.query_hostapis()
        for idx, dev in enumerate(devices):
            if dev.get("max_input_channels", 0) > 0:
                api_name = hostapis[dev["hostapi"]]["name"] if dev.get("hostapi") is not None else ""
                microphones.append(
                    {
                        "id": idx,
                        "name": dev["name"],
                        "hostapi": api_name,
                        "channels": int(dev["max_input_channels"]),
                        "sample_rate": int(dev.get("default_samplerate", 44100)),
                        "is_default": idx == default_mic,
                    }
                )
    except Exception as exc:
        logger.warning("Failed to query sounddevice microphones: %s", exc)

    loopback_supported = False
    loopback_devices: list[dict[str, Any]] = []
    system_audio_reason = ""

    if sys.platform == "win32":
        try:
            import pyaudiowpatch as pyaudio  # type: ignore

            pa = pyaudio.PyAudio()
            try:
                wasapi_info = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
                loopback_supported = True
                default_out_idx = wasapi_info.get("defaultOutputDevice", -1)
                for lb in pa.get_loopback_device_info_generator():
                    loopback_devices.append(
                        {
                            "id": int(lb["index"]),
                            "name": lb["name"],
                            "channels": int(lb["maxInputChannels"]),
                            "sample_rate": int(lb["defaultSampleRate"]),
                            "is_default": default_out_idx >= 0
                            and pa.get_device_info_by_index(default_out_idx)["name"] in lb["name"],
                        }
                    )
                if not loopback_devices:
                    loopback_supported = False
                    system_audio_reason = "No Windows WASAPI loopback devices found."
            finally:
                pa.terminate()
        except Exception as exc:
            logger.warning("WASAPI loopback unavailable: %s", exc)
            system_audio_reason = f"WASAPI loopback unavailable: {exc}"
    elif sys.platform == "darwin":
        for dev in microphones:
            if "blackhole" in dev["name"].lower():
                loopback_devices.append({**dev, "is_default": len(loopback_devices) == 0})
        if loopback_devices:
            loopback_supported = True
        else:
            system_audio_reason = (
                "macOS has no built-in system audio loopback. Install BlackHole "
                "(e.g., `brew install blackhole-2ch`) and select it in Audio MIDI Setup."
            )
    else:
        # Linux / POSIX: PulseAudio & PipeWire expose output monitors as input devices with 'monitor' in the name
        for dev in microphones:
            if "monitor" in dev["name"].lower():
                loopback_devices.append({**dev, "is_default": len(loopback_devices) == 0})
        if loopback_devices:
            loopback_supported = True
        else:
            system_audio_reason = "No PulseAudio or PipeWire monitor source detected."

    return {
        "microphones": microphones,
        "loopback_devices": loopback_devices,
        "system_audio_supported": loopback_supported,
        "system_audio_reason": system_audio_reason,
        "platform": sys.platform,
    }


class AudioCaptureBackend(Protocol):
    """Platform abstraction for audio capture streams (Windows now, macOS later)."""

    def start(self) -> None: ...
    def stop(self) -> None: ...


class ChannelVADBuffer:
    """Buffers 16 kHz mono audio and emits partial/final speech segments via energy VAD."""

    def __init__(
        self,
        speaker: str,
        vad_threshold: float,
        noise_reduction: bool,
        on_segment: Callable[[str, np.ndarray, int, bool], None],
    ) -> None:
        self.speaker = speaker
        self.vad_threshold = vad_threshold
        self.noise_reduction = noise_reduction
        self.on_segment = on_segment

        self._chunks: list[np.ndarray] = []
        self._speaking = False
        self._segment_start_ms = 0
        self._last_voice_time = 0.0
        self._last_partial_time = 0.0
        self._total_samples = 0

    def push(self, chunk_16k: np.ndarray, session_start_monotonic: float) -> float:
        if chunk_16k.size == 0:
            return 0.0

        rms = float(np.sqrt(np.mean(np.square(chunk_16k))))
        now = time.monotonic()

        # Simple noise gate when below threshold
        processed = chunk_16k
        if self.noise_reduction and rms < self.vad_threshold * 0.65:
            processed = chunk_16k * 0.05

        is_voice = rms >= self.vad_threshold
        if is_voice:
            if not self._speaking:
                self._speaking = True
                self._segment_start_ms = int((now - session_start_monotonic) * 1000)
                self._last_partial_time = now
            self._last_voice_time = now
            self._chunks.append(processed)
            self._total_samples += processed.shape[0]

            # Emit partial update every 1.4s while speaking
            if now - self._last_partial_time >= 1.4 and self._total_samples >= int(TARGET_SAMPLE_RATE * 0.6):
                self._last_partial_time = now
                audio = np.concatenate(self._chunks)
                self.on_segment(self.speaker, audio, self._segment_start_ms, False)

            # Force finalization if continuous speech exceeds 12s
            if self._total_samples >= TARGET_SAMPLE_RATE * 12:
                self._flush_final()
        elif self._speaking:
            # Keep trailing silence for natural phrasing
            self._chunks.append(processed)
            self._total_samples += processed.shape[0]
            if now - self._last_voice_time >= 0.85:
                self._flush_final()

        return min(1.0, rms * 6.0)

    def flush(self) -> None:
        if self._speaking and self._total_samples >= int(TARGET_SAMPLE_RATE * 0.35):
            self._flush_final()
        else:
            self._reset()

    def _flush_final(self) -> None:
        if not self._chunks:
            self._reset()
            return
        audio = np.concatenate(self._chunks)
        start_ms = self._segment_start_ms
        self._reset()
        if audio.shape[0] >= int(TARGET_SAMPLE_RATE * 0.35):
            self.on_segment(self.speaker, audio, start_ms, True)

    def _reset(self) -> None:
        self._chunks = []
        self._speaking = False
        self._total_samples = 0


class AudioEngine:
    """Manages live microphone + Windows WASAPI loopback capture with pause/resume and metering."""

    def __init__(
        self,
        on_segment: Callable[[str, np.ndarray, int, bool], None],
        on_levels: Callable[[float, float], None],
    ) -> None:
        self.on_segment = on_segment
        self.on_levels = on_levels

        self._running = False
        self._paused = False
        self._session_id: str | None = None
        self._start_monotonic = 0.0

        self._mic_stream: sd.InputStream | None = None
        self._sys_stream: sd.InputStream | None = None
        self._loopback_thread: threading.Thread | None = None
        self._worker_thread: threading.Thread | None = None
        self._audio_queue: queue.Queue[tuple[str, np.ndarray, int]] = queue.Queue(maxsize=256)

        self._mic_vad: ChannelVADBuffer | None = None
        self._sys_vad: ChannelVADBuffer | None = None
        self._mic_level = 0.0
        self._sys_level = 0.0

    @property
    def status(self) -> dict[str, Any]:
        return {
            "capturing": self._running,
            "paused": self._paused,
            "session_id": self._session_id,
            "mic_level": round(self._mic_level, 3),
            "system_level": round(self._sys_level, 3),
        }

    def start(
        self,
        session_id: str,
        mic_device_id: int | None = None,
        capture_system_audio: bool = True,
        noise_reduction: bool = True,
        vad_threshold: float = 0.015,
    ) -> None:
        self.stop()

        self._session_id = session_id
        self._running = True
        self._paused = False
        self._start_monotonic = time.monotonic()

        self._mic_vad = ChannelVADBuffer("You", vad_threshold, noise_reduction, self.on_segment)
        self._sys_vad = ChannelVADBuffer("System", vad_threshold, noise_reduction, self.on_segment)

        # Start microphone stream
        try:
            dev_info = sd.query_devices(mic_device_id, "input") if mic_device_id is not None else sd.query_devices(kind="input")
            mic_rate = int(dev_info.get("default_samplerate", 44100))

            def mic_callback(indata: np.ndarray, frames: int, time_info: Any, status_flags: Any) -> None:
                if not self._running or self._paused:
                    return
                mono = indata[:, 0].copy() if indata.ndim > 1 else indata.copy()
                try:
                    self._audio_queue.put_nowait(("mic", mono, mic_rate))
                except queue.Full:
                    pass

            self._mic_stream = sd.InputStream(
                device=mic_device_id,
                channels=1,
                samplerate=mic_rate,
                dtype="float32",
                blocksize=int(mic_rate * 0.08),
                callback=mic_callback,
            )
            self._mic_stream.start()
        except Exception as exc:
            logger.error("Could not start microphone capture: %s", exc)
            self._running = False
            raise RuntimeError(f"Microphone capture failed: {exc}") from exc

        # Start system audio loopback if requested & supported
        if capture_system_audio:
            if sys.platform == "win32":
                self._loopback_thread = threading.Thread(target=self._run_wasapi_loopback, daemon=True)
                self._loopback_thread.start()
            else:
                self._start_sounddevice_system_stream()

        self._worker_thread = threading.Thread(target=self._process_loop, daemon=True)
        self._worker_thread.start()

    def pause(self) -> None:
        self._paused = True
        self._mic_level = 0.0
        self._sys_level = 0.0
        if self._mic_vad:
            self._mic_vad.flush()
        if self._sys_vad:
            self._sys_vad.flush()

    def resume(self) -> None:
        self._paused = False

    def stop(self) -> None:
        self._running = False
        self._paused = False
        if self._mic_stream is not None:
            try:
                self._mic_stream.stop()
                self._mic_stream.close()
            except Exception:
                pass
            self._mic_stream = None

        if self._sys_stream is not None:
            try:
                self._sys_stream.stop()
                self._sys_stream.close()
            except Exception:
                pass
            self._sys_stream = None

        if self._worker_thread is not None and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.5)
        if self._loopback_thread is not None and self._loopback_thread.is_alive():
            self._loopback_thread.join(timeout=1.5)

        if self._mic_vad:
            self._mic_vad.flush()
        if self._sys_vad:
            self._sys_vad.flush()

        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except queue.Empty:
                break

        self._mic_level = 0.0
        self._sys_level = 0.0
        self._session_id = None

    def _start_sounddevice_system_stream(self) -> None:
        """Open a PulseAudio/PipeWire monitor (Linux) or BlackHole (macOS) input stream for system audio."""
        try:
            devices_info = list_audio_devices()
            loopbacks = devices_info.get("loopback_devices", [])
            if not loopbacks:
                logger.info("System audio capture skipped: %s", devices_info.get("system_audio_reason", "unavailable"))
                return
            target = loopbacks[0]
            sys_rate = int(target.get("sample_rate", 44100))
            dev_id = int(target["id"])

            def sys_callback(indata: np.ndarray, frames: int, time_info: Any, status_flags: Any) -> None:
                if not self._running or self._paused:
                    return
                mono = indata[:, 0].copy() if indata.ndim > 1 else indata.copy()
                try:
                    self._audio_queue.put_nowait(("system", mono, sys_rate))
                except queue.Full:
                    pass

            self._sys_stream = sd.InputStream(
                device=dev_id,
                channels=1,
                samplerate=sys_rate,
                dtype="float32",
                blocksize=int(sys_rate * 0.08),
                callback=sys_callback,
            )
            self._sys_stream.start()
        except Exception as exc:
            logger.warning("Non-Windows system audio stream failed to start: %s", exc)

    def _run_wasapi_loopback(self) -> None:
        try:
            import pyaudiowpatch as pyaudio  # type: ignore

            pa = pyaudio.PyAudio()
            try:
                wasapi_info = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
                default_out = pa.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
                target_lb = None
                for lb in pa.get_loopback_device_info_generator():
                    if default_out["name"] in lb["name"]:
                        target_lb = lb
                        break
                if target_lb is None:
                    logger.info("No default WASAPI loopback device found.")
                    return

                channels = int(target_lb["maxInputChannels"])
                rate = int(target_lb["defaultSampleRate"])
                chunk_frames = int(rate * 0.08)

                stream = pa.open(
                    format=pyaudio.paInt16,
                    channels=channels,
                    rate=rate,
                    input=True,
                    input_device_index=int(target_lb["index"]),
                    frames_per_buffer=chunk_frames,
                )
                try:
                    while self._running:
                        data = stream.read(chunk_frames, exception_on_overflow=False)
                        if self._paused:
                            continue
                        samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                        if channels > 1:
                            samples = samples.reshape(-1, channels).mean(axis=1)
                        try:
                            self._audio_queue.put_nowait(("system", samples, rate))
                        except queue.Full:
                            pass
                finally:
                    stream.stop_stream()
                    stream.close()
            finally:
                pa.terminate()
        except Exception as exc:
            logger.warning("WASAPI loopback stream stopped: %s", exc)

    def _process_loop(self) -> None:
        last_level_emit = 0.0
        while self._running:
            try:
                source, samples, rate = self._audio_queue.get(timeout=0.1)
            except queue.Empty:
                now = time.monotonic()
                if now - last_level_emit >= 0.08:
                    last_level_emit = now
                    self.on_levels(self._mic_level, self._sys_level)
                continue

            audio_16k = resample_to_16k(samples, rate)
            if source == "mic" and self._mic_vad is not None:
                self._mic_level = self._mic_vad.push(audio_16k, self._start_monotonic)
            elif source == "system" and self._sys_vad is not None:
                self._sys_level = self._sys_vad.push(audio_16k, self._start_monotonic)

            now = time.monotonic()
            if now - last_level_emit >= 0.07:
                last_level_emit = now
                self.on_levels(self._mic_level, self._sys_level)
