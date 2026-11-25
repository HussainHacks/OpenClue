import React, { useEffect, useState } from 'react';
import { Camera, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ScreenSourceMonitor, ScreenSourceWindow } from '../types';

export const ScreenSettingsScreen: React.FC = () => {
  const { settings, updateSettings, latestScreen, captureScreenNow, privacyStatus, setPrivacyMode } = useAppStore();
  const [monitors, setMonitors] = useState<ScreenSourceMonitor[]>([]);
  const [windows, setWindows] = useState<ScreenSourceWindow[]>([]);
  const [windowReason, setWindowReason] = useState('');
  const [testing, setTesting] = useState(false);

  const loadSources = async () => {
    try {
      const res = await api.getScreenSources();
      setMonitors(res.monitors);
      setWindows(res.windows);
      setWindowReason(res.window_listing_reason || '');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleTestCapture = async () => {
    setTesting(true);
    try {
      await captureScreenNow();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Screen Context & Sharing Privacy</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Select which monitor or window OpenClue can read via local OCR, and manage screen-sharing privacy.
          </p>
        </div>
        <button
          onClick={loadSources}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Windows
        </button>
      </div>

      {/* Screen-Sharing Privacy Mode */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Screen-Sharing Privacy Mode
          </div>
          <input
            type="checkbox"
            disabled={!privacyStatus.supported}
            checked={privacyStatus.supported && privacyStatus.enabled}
            onChange={(e) => setPrivacyMode(e.target.checked)}
            className="accent-emerald-500 w-4 h-4 disabled:opacity-40"
          />
        </div>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          When enabled, OpenClue applies OS-level capture exclusion (<code>{privacyStatus.mechanism}</code>) to both the
          Floating Assistant Overlay and the Main Workspace so your private notes and API credentials are not shown when
          sharing your screen in a meeting.
        </p>
        {!privacyStatus.supported && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
            Fallback active: OS capture exclusion is unavailable on this OS. Keep private assistant content in the
            separate Floating Overlay and share only your target application window in your meeting software.
          </div>
        )}
      </div>

      {/* Screen Context Capture */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Enable Screen Context OCR</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Never captures unless explicitly enabled by you.
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settings?.screen_capture_enabled)}
            onChange={(e) => updateSettings({ screen_capture_enabled: e.target.checked })}
            className="accent-sky-500 w-4 h-4"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold block mb-1.5">Monitor</label>
            <select
              value={settings?.selected_monitor_index ?? 1}
              onChange={(e) => updateSettings({ selected_monitor_index: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              {monitors.map((m) => (
                <option key={m.index} value={m.index}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold block mb-1.5">Target Application Window (Optional)</label>
            <select
              value={settings?.selected_window_title ?? ''}
              onChange={(e) => updateSettings({ selected_window_title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <option value="">Entire Selected Monitor</option>
              {windows.map((w) => (
                <option key={w.hwnd} value={w.title}>
                  {w.title}
                </option>
              ))}
            </select>
            {windowReason && <p className="text-[11px] text-[var(--text-muted)] mt-1">{windowReason}</p>}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="font-semibold">Auto-Capture Interval (when Screen Context is enabled)</span>
            <span className="font-mono text-sky-400">
              {settings?.screen_capture_interval_sec ? `${settings.screen_capture_interval_sec}s` : 'Manual Only'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="60"
            step="5"
            value={settings?.screen_capture_interval_sec ?? 15}
            onChange={(e) => updateSettings({ screen_capture_interval_sec: Number(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={handleTestCapture}
            disabled={testing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold"
          >
            <Camera className="w-3.5 h-3.5" />
            {testing ? 'Capturing & Running OCR...' : 'Capture & Test OCR Now'}
          </button>
          {latestScreen?.source_label && (
            <span className="text-[11px] text-[var(--text-muted)]">
              Last captured: {latestScreen.source_label} ({latestScreen.ocr_text.length} chars)
            </span>
          )}
        </div>

        {latestScreen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {latestScreen.thumbnail_b64 && (
              <img
                src={`data:image/jpeg;base64,${latestScreen.thumbnail_b64}`}
                alt="Captured screen preview"
                className="rounded-lg border border-[var(--border-subtle)] w-full object-contain max-h-44 bg-black"
              />
            )}
            <pre className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[11px] max-h-44 overflow-y-auto whitespace-pre-wrap font-mono">
              {latestScreen.ocr_text || '(No text detected)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
