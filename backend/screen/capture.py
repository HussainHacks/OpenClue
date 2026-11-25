from __future__ import annotations

import base64
import ctypes
import io
import logging
import os
import shutil
import subprocess
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


def _enum_windows_macos() -> tuple[list[dict[str, Any]], bool, str]:
    """Enumerate visible on-screen windows on macOS via Quartz CGWindowListCopyWindowInfo."""
    try:
        import Quartz  # type: ignore
    except Exception as exc:
        return [], False, f"macOS window listing unavailable (Quartz not installed: {exc}). Monitors only."

    try:
        opts = Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements
        raw_list = Quartz.CGWindowListCopyWindowInfo(opts, Quartz.kCGNullWindowID) or []
        windows: list[dict[str, Any]] = []
        for entry in raw_list:
            owner = str(entry.get("kCGWindowOwnerName", "") or "")
            name = str(entry.get("kCGWindowName", "") or "")
            title = f"{owner} - {name}".strip(" -") if name and owner else (name or owner)
            if not title or title.startswith("OpenClue"):
                continue
            bounds = entry.get("kCGWindowBounds", {}) or {}
            width = int(bounds.get("Width", 0))
            height = int(bounds.get("Height", 0))
            if width < 120 or height < 80:
                continue
            windows.append(
                {
                    "hwnd": int(entry.get("kCGWindowNumber", 0)),
                    "title": title,
                    "bounds": {
                        "left": int(bounds.get("X", 0)),
                        "top": int(bounds.get("Y", 0)),
                        "width": width,
                        "height": height,
                    },
                }
            )
        return windows, True, ""
    except Exception as exc:
        return [], False, f"macOS window listing failed ({exc}). Monitors only."


def _enum_windows_linux() -> tuple[list[dict[str, Any]], bool, str]:
    """Enumerate X11 windows on Linux via wmctrl or xprop when available."""
    if not os.environ.get("DISPLAY"):
        return [], False, "Window listing unavailable without an X11 DISPLAY (Wayland/headless). Monitors only."

    if shutil.which("wmctrl"):
        try:
            proc = subprocess.run(["wmctrl", "-lG"], capture_output=True, text=True, timeout=3, check=False)
            if proc.returncode == 0:
                windows: list[dict[str, Any]] = []
                for line in proc.stdout.splitlines():
                    parts = line.split(None, 7)
                    if len(parts) < 8:
                        continue
                    win_id_hex, _desk, x_s, y_s, w_s, h_s, _host, title = parts
                    title = title.strip()
                    if not title or title.startswith("OpenClue"):
                        continue
                    w, h = int(w_s), int(h_s)
                    if w < 120 or h < 80:
                        continue
                    windows.append(
                        {
                            "hwnd": int(win_id_hex, 16),
                            "title": title,
                            "bounds": {"left": int(x_s), "top": int(y_s), "width": w, "height": h},
                        }
                    )
                return windows, True, ""
        except Exception as exc:
            logger.debug("wmctrl failed: %s", exc)

    if shutil.which("xprop"):
        try:
            proc = subprocess.run(
                ["xprop", "-root", "_NET_CLIENT_LIST"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if proc.returncode == 0 and "#" in proc.stdout:
                ids = [tok.strip() for tok in proc.stdout.split("#", 1)[1].split(",") if tok.strip()]
                windows = []
                for wid in ids[:40]:
                    info = subprocess.run(
                        ["xprop", "-id", wid, "WM_NAME"],
                        capture_output=True,
                        text=True,
                        timeout=1,
                        check=False,
                    )
                    title = ""
                    if "=" in info.stdout:
                        title = info.stdout.split("=", 1)[1].strip().strip('"')
                    if not title or title.startswith("OpenClue"):
                        continue
                    windows.append(
                        {
                            "hwnd": int(wid, 16),
                            "title": title,
                            "bounds": {"left": 0, "top": 0, "width": 0, "height": 0},
                        }
                    )
                return windows, True, ""
        except Exception as exc:
            logger.debug("xprop failed: %s", exc)

    return [], False, "Window listing requires wmctrl or xprop on X11 Linux. Monitors only."


def _list_windows() -> tuple[list[dict[str, Any]], bool, str]:
    if sys.platform == "win32":
        return _enum_windows_win32(), True, ""
    if sys.platform == "darwin":
        return _enum_windows_macos()
    return _enum_windows_linux()


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
        windows, win_supported, win_reason = _list_windows()
        return {
            "monitors": monitors,
            "windows": windows,
            "window_listing_supported": win_supported,
            "window_listing_reason": win_reason,
        }

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
            windows, _, _ = _list_windows()
            for win in windows:
                if win["title"] == window_title or window_title.lower() in win["title"].lower():
                    if win["bounds"]["width"] >= 120 and win["bounds"]["height"] >= 80:
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
