import React from 'react';
import { Mic, MicOff, Monitor, MonitorOff, Pause, Play, ShieldAlert, ShieldCheck, Square } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const StatusBar: React.FC = () => {
  const {
    capturing,
    paused,
    micLevel,
    systemLevel,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    settings,
    updateSettings,
    privacyStatus,
    activeSession,
  } = useAppStore();

  return (
    <header className="h-12 px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-medium text-[var(--text-muted)]">Session:</span>
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[220px]">
          {activeSession ? activeSession.title : 'No active session'}
        </span>

        {/* Explicit Capture State Indicator */}
        {capturing ? (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
              paused
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`} />
            {paused ? 'Paused' : 'Recording Audio'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            <MicOff className="w-3 h-3" />
            Audio Idle
          </span>
        )}

        {/* Audio Level Bars */}
        {capturing && !paused && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1" title="Microphone Level">
              <span>Mic</span>
              <div className="w-14 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
                />
              </div>
            </div>
            {settings?.capture_system_audio && (
              <div className="flex items-center gap-1" title="System Audio Level">
                <span>Sys</span>
                <div className="w-14 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.round(systemLevel * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Screen Context Indicator */}
        <button
          onClick={() => updateSettings({ screen_capture_enabled: !settings?.screen_capture_enabled })}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            settings?.screen_capture_enabled
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
          }`}
          title="Toggle Screen Context Permission"
        >
          {settings?.screen_capture_enabled ? <Monitor className="w-3.5 h-3.5" /> : <MonitorOff className="w-3.5 h-3.5" />}
          {settings?.screen_capture_enabled ? 'Screen OCR On' : 'Screen Off'}
        </button>

        {/* Privacy Mode Pill */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
            privacyStatus.enabled
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
          }`}
          title={privacyStatus.mechanism}
        >
          {privacyStatus.enabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          {privacyStatus.enabled ? 'Hidden in Screen Share' : 'Visible in Share'}
        </span>

        {/* Audio Transport Controls */}
        {!capturing ? (
          <button
            onClick={() => startCapture()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
            Start Listening
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            {paused ? (
              <button
                onClick={() => resumeCapture()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                Resume
              </button>
            ) : (
              <button
                onClick={() => pauseCapture()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            )}
            <button
              onClick={() => stopCapture()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
