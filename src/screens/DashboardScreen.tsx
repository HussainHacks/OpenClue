import React, { useState } from 'react';
import { Activity, ArrowUpRight, FolderOpen, Mic, PanelTop, Plus, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const DashboardScreen: React.FC = () => {
  const {
    sessions,
    createAndSelectSession,
    selectSession,
    setScreen,
    startCapture,
    settings,
  } = useAppStore();

  const [newTitle, setNewTitle] = useState('');
  const [sessionType, setSessionType] = useState('meeting');

  const handleCreate = async (startAudioNow: boolean) => {
    const title = newTitle.trim() || `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    await createAndSelectSession(title, sessionType);
    setNewTitle('');
    setScreen('live');
    if (startAudioNow) {
      await startCapture();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Active AI: <span className="text-sky-400 font-medium">{settings?.ai_provider}</span> ({settings?.ai_model})
            {' · '}Whisper: <span className="text-indigo-400 font-medium">{settings?.whisper_model}</span>
          </p>
        </div>
        <button
          onClick={() => window.openclue?.toggleOverlay(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-xs font-medium transition-colors"
        >
          <PanelTop className="w-4 h-4 text-sky-400" />
          Launch Floating Overlay
        </button>
      </div>

      {/* Start New Session Card */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="w-4 h-4 text-sky-400" />
          Start a New Session
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Session title (e.g., Architecture Sync, Technical Interview)"
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-sky-500"
          />
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="meeting">Meeting</option>
            <option value="interview">Interview</option>
            <option value="presentation">Presentation</option>
            <option value="research">Research</option>
          </select>
          <button
            onClick={() => handleCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
            Start & Listen
          </button>
          <button
            onClick={() => handleCreate(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Blank
          </button>
        </div>
      </div>

      {/* Shortcuts & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Sessions</h2>
            <button
              onClick={() => setScreen('history')}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-6 text-center">
              No sessions yet. Start listening above to record your first transcript.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {sessions.slice(0, 6).map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{s.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {s.session_type} · {s.transcript_count ?? 0} segments · {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await selectSession(s.id);
                        setScreen('live');
                      }}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11px] font-medium flex items-center gap-1"
                    >
                      <Activity className="w-3 h-3 text-sky-400" />
                      Live
                    </button>
                    <button
                      onClick={async () => {
                        await selectSession(s.id);
                        setScreen('transcript');
                      }}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[11px] font-medium flex items-center gap-1"
                    >
                      <FolderOpen className="w-3 h-3 text-indigo-400" />
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3">
          <h2 className="text-sm font-semibold">Global Shortcuts</h2>
          <div className="space-y-2.5 text-xs">
            {[
              ['Toggle Floating Overlay', 'Ctrl+Shift+Space'],
              ['Quick Ask in Overlay', 'Ctrl+Enter'],
              ['Toggle Audio Capture', 'Ctrl+Shift+M'],
              ['Toggle Share Privacy', 'Ctrl+Shift+P'],
            ].map(([label, key]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">{label}</span>
                <kbd className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
