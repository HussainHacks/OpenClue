from __future__ import annotations

import base64
import ctypes
import io
import logging
import sys
import threading
from datetime import datetime, timezone
from typing import Any

import mss
import numpy as np
from PIL import Image, ImageGrab

logger = logging.getLogger("openclue.screen")


def _enum_windows_win32() -> list[dict[str, Any]]:
    """Enumerate visible top-level windows on Windows, excluding OpenClue's own windows."""
    if sys.platform != "win32":
        return []

    user32 = ctypes.windll.user32
    windows: list[dict[str, Any]] = []

    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    class RECT(ctypes.Structure):
        _fields_ = [
            ("left", ctypes.c_long),
            ("top", ctypes.c_long),
            ("right", ctypes.c_long),
            ("bottom", ctypes.c_long),
        ]

    def callback(hwnd: int, _lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value.strip()
        if not title or title.startswith("OpenClue"):
            return True
        rect = RECT()
        if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            width = rect.right - rect.left
            height = rect.bottom - rect.top
            if width >= 120 and height >= 80:
                windows.append(
                    {
                        "hwnd": int(hwnd),
                        "title": title,
                        "bounds": {
                            "left": int(rect.left),
                            "top": int(rect.top),
                            "width": int(width),
                            "height": int(height),
                        },
                    }
                )
        return True

    user32.EnumWindows(EnumWindowsProc(callback), 0)
    return windows


class ScreenContextEngine:
    """Explicit, user-controlled screen/window capture and local RapidOCR extraction."""

    def __init__(self) -> None:
        self._ocr_lock = threading.Lock()
        self._ocr_engine: Any = None
        self.latest_ocr_text: str = ""
        self.latest_source_label: str = ""
        self.latest_captured_at: str = ""
        self.latest_thumbnail_b64: str = ""

    def _get_ocr(self) -> Any:
        with self._ocr_lock:
            if self._ocr_engine is None:
                from rapidocr_onnxruntime import RapidOCR  # type: ignore

                self._ocr_engine = RapidOCR()
            return self._ocr_engine

    def list_sources(self) -> dict[str, Any]:
        monitors: list[dict[str, Any]] = []
        with mss.MSS() as sct:
            for idx, mon in enumerate(sct.monitors):
                if idx == 0:
                    continue  # skip virtual combined screen
                monitors.append(
                    {
                        "index": idx,
                        "name": f"Display {idx} ({mon['width']}x{mon['height']})",
                        "bounds": {
                            "left": mon["left"],
                            "top": mon["top"],
                            "width": mon["width"],
                            "height": mon["height"],
                        },
                    }
                )
        windows = _enum_windows_win32()
        return {"monitors": monitors, "windows": windows}

    def run_ocr_on_image(self, img: Image.Image, source_label: str = "Image") -> dict[str, Any]:
        """Run local RapidOCR on a PIL Image and return structured OCR + thumbnail."""
        max_dim = 1920
        if img.width > max_dim or img.height > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        ocr = self._get_ocr()
        np_img = np.array(img)
        with self._ocr_lock:
            result, _ = ocr(np_img)

        lines: list[str] = []
        if result:
            for item in result:
                if len(item) >= 2 and isinstance(item[1], str):
                    txt = item[1].strip()
                    if txt:
                        lines.append(txt)

        ocr_text = "\n".join(lines).strip()

        thumb = img.copy()
        thumb.thumbnail((480, 270), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        thumb.save(buf, format="JPEG", quality=70)
        thumb_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        now_iso = datetime.now(timezone.utc).isoformat()
        self.latest_ocr_text = ocr_text
        self.latest_source_label = source_label
        self.latest_captured_at = now_iso
        self.latest_thumbnail_b64 = thumb_b64

        return {
            "ocr_text": ocr_text,
            "source_label": source_label,
            "captured_at": now_iso,
            "thumbnail_b64": thumb_b64,
            "char_count": len(ocr_text),
        }

    def capture_and_ocr(
        self,
        monitor_index: int = 1,
        window_title: str = "",
    ) -> dict[str, Any]:
        """Capture the chosen monitor or window and extract text via RapidOCR."""
        region: dict[str, int] | None = None
        source_label = f"Display {monitor_index}"

        if window_title:
            for win in _enum_windows_win32():
                if win["title"] == window_title or window_title.lower() in win["title"].lower():
                    region = win["bounds"]
                    source_label = win["title"]
                    break

        img: Image.Image | None = None
        try:
            with mss.MSS() as sct:
                if region is None:
                    idx = monitor_index if 1 <= monitor_index < len(sct.monitors) else 1
                    mon = sct.monitors[idx]
                    region = {
                        "left": mon["left"],
                        "top": mon["top"],
                        "width": mon["width"],
                        "height": mon["height"],
                    }
                    source_label = f"Display {idx}"

                raw = sct.grab(region)
                img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
        except Exception as exc:
            logger.warning("mss capture failed (%s), trying PIL ImageGrab fallback...", exc)
            if region is not None:
                bbox = (
                    region["left"],
                    region["top"],
                    region["left"] + region["width"],
                    region["top"] + region["height"],
                )
                img = ImageGrab.grab(bbox=bbox)
            else:
                img = ImageGrab.grab()

        return self.run_ocr_on_image(img, source_label=source_label)

    def clear(self) -> None:
        self.latest_ocr_text = ""
        self.latest_source_label = ""
        self.latest_captured_at = ""
        self.latest_thumbnail_b64 = ""
