import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mic,
  Pin,
  Send,
  ShieldAlert,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { OpenClueLogo } from '../components/Logo';

export const FloatingOverlayView: React.FC = () => {
  const {
    ready,
    init,
    capturing,
    transcripts,
    partialTranscript,
    messages,
    streamingAnswer,
    isAsking,
    aiError,
    privacyStatus,
    startCapture,
    stopCapture,
    askQuestion,
    captureScreenNow,
    setPrivacyMode,
  } = useAppStore();

  const [collapsed, setCollapsed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!window.openclue) return;
    return window.openclue.onShortcutEvent((name) => {
      if (name === 'focus-ask') {
        setCollapsed(false);
        inputRef.current?.focus();
      }
    });
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.openclue?.setOverlayBounds(430, next ? 56 : 560);
  };

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    await window.openclue?.setAlwaysOnTop(next);
  };

  const handleAsk = async (q?: string) => {
    const query = (q ?? input).trim();
    if (!query || isAsking) return;
    if (!q) setInput('');
    await askQuestion(query, true);
  };

  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  if (!ready) {
    return (
      <div className="h-screen w-screen bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-xl flex items-center justify-center text-xs text-[var(--text-secondary)]">
        Connecting...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-secondary)]/95 backdrop-blur-md border border-[var(--border-strong)] rounded-xl overflow-hidden shadow-2xl">
      {/* Draggable Header */}
      <div className="drag-region h-11 px-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <OpenClueLogo size={20} />
          <span className="text-xs font-semibold">OpenClue</span>
          {capturing && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="no-drag flex items-center gap-1">
          <button
            onClick={() => privacyStatus.supported && setPrivacyMode(!privacyStatus.enabled)}
            disabled={!privacyStatus.supported}
            title={privacyStatus.mechanism}
            className={`p-1.5 rounded-md text-xs ${
              !privacyStatus.supported
                ? 'text-[var(--text-muted)] cursor-not-allowed'
                : privacyStatus.enabled
                  ? 'text-emerald-400 hover:bg-emerald-500/15'
                  : 'text-amber-400 hover:bg-amber-500/15'
            }`}
          >
            {privacyStatus.supported && privacyStatus.enabled ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={togglePin}
            title="Always on Top"
            className={`p-1.5 rounded-md ${pinned ? 'text-sky-400 bg-sky-500/10' : 'text-[var(--text-muted)]'}`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.openclue?.focusMainWindow('live')}
            title="Open Full Workspace"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expand' : 'Minimize'}
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => window.openclue?.toggleOverlay(false)}
            title="Hide Overlay (Ctrl+Shift+Space)"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-rose-500/20 hover:text-rose-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Quick Controls */}
          <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              {!capturing ? (
                <button
                  onClick={() => startCapture()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold"
                >
                  <Mic className="w-3 h-3" />
                  Listen
                </button>
              ) : (
                <button
                  onClick={() => stopCapture()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              )}
              <button
                onClick={() => captureScreenNow()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)]"
                title="Capture Screen Context"
              >
                <Camera className="w-3 h-3 text-sky-400" />
                OCR
              </button>
            </div>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {showTranscript && (
              <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] max-h-32 overflow-y-auto space-y-1.5">
                <div className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Recent Transcript</div>
                {transcripts.length === 0 && !partialTranscript ? (
                  <div className="text-[11px] text-[var(--text-muted)]">Waiting for audio...</div>
                ) : (
                  <>
                    {transcripts.slice(-4).map((t, i) => (
                      <div key={t.id || i} className="text-[11px]">
                        <span className="font-semibold text-sky-400">{t.speaker}: </span>
                        <span className="text-[var(--text-secondary)]">{t.text}</span>
                      </div>
                    ))}
                    {partialTranscript && (
                      <div className="text-[11px] italic text-sky-300/80">
                        {partialTranscript.speaker}: {partialTranscript.text}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Answer Display */}
            <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] min-h-[120px] whitespace-pre-wrap leading-relaxed">
              <div className="text-[10px] font-semibold uppercase text-sky-400 mb-1">
                {streamingAnswer ? 'AI Answering...' : 'Assistant'}
              </div>
              {aiError ? (
                <span className="text-rose-400">{aiError}</span>
              ) : streamingAnswer ? (
                streamingAnswer
              ) : latestAssistant ? (
                latestAssistant.content
              ) : (
                <span className="text-[var(--text-muted)]">
                  Ask a quick question below or click a prompt chip.
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['What should I say next?', 'Summarize last 2 mins', 'Explain this screen'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleAsk(chip)}
                  disabled={isAsking}
                  className="px-2 py-1 rounded-md bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-2.5 border-t border-[var(--border-subtle)] flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Quick question..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => handleAsk()}
              disabled={isAsking || !input.trim()}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
