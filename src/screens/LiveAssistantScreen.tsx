import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Send, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const LiveAssistantScreen: React.FC = () => {
  const {
    activeSession,
    transcripts,
    partialTranscript,
    messages,
    streamingAnswer,
    isAsking,
    aiError,
    audioError,
    latestScreen,
    settings,
    askQuestion,
    captureScreenNow,
    updateSettings,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [includeScreen, setIncludeScreen] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, partialTranscript]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingAnswer]);

  const handleAsk = async (promptText?: string) => {
    const q = (promptText ?? input).trim();
    if (!q || isAsking) return;
    if (!promptText) setInput('');
    await askQuestion(q, includeScreen);
  };

  return (
    <div className="h-[calc(100vh-3rem)] p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
      {/* Left: Live Transcript + Screen Context */}
      <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
        <div className="flex-1 flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] min-h-0">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <span className="text-xs font-semibold">Live Transcript</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {activeSession ? `${transcripts.length} segments` : 'No session'}
            </span>
          </div>

          {audioError && (
            <div className="mx-3 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{audioError}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {transcripts.length === 0 && !partialTranscript ? (
              <div className="text-[var(--text-muted)] text-center py-10">
                Click <strong>Start Listening</strong> in the top bar to begin real-time Whisper transcription.
              </div>
            ) : (
              <>
                {transcripts.map((t, idx) => (
                  <div key={t.id || idx} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          t.speaker === 'You'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-indigo-500/15 text-indigo-400'
                        }`}
                      >
                        {t.speaker}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatMs(t.timestamp_ms)}
                      </span>
                    </div>
                    <p className="text-[var(--text-primary)] leading-relaxed">{t.text}</p>
                  </div>
                ))}
                {partialTranscript && (
                  <div className="opacity-70 italic space-y-0.5 border-l-2 border-sky-500/50 pl-2">
                    <div className="text-[10px] text-sky-400 font-semibold">
                      {partialTranscript.speaker} (listening...)
                    </div>
                    <p>{partialTranscript.text}</p>
                  </div>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Screen Context Card */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Screen Context (OCR)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!settings?.screen_capture_enabled) {
                    await updateSettings({ screen_capture_enabled: true });
                  }
                  await captureScreenNow();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-medium"
              >
                <Camera className="w-3 h-3 text-sky-400" />
                Capture Now
              </button>
            </div>
          </div>
          {latestScreen?.ocr_text ? (
            <div className="text-[11px] text-[var(--text-secondary)] max-h-24 overflow-y-auto bg-[var(--bg-primary)] p-2 rounded-lg border border-[var(--border-subtle)] font-mono whitespace-pre-wrap">
              {latestScreen.ocr_text.slice(0, 600)}
            </div>
          ) : (
            <div className="text-[11px] text-[var(--text-muted)]">
              No screen text captured yet. Click Capture Now when you want the AI to read your selected monitor or window.
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Assistant Conversation */}
      <div className="lg:col-span-7 flex flex-col rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] min-h-0">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold">Context-Aware AI Assistant</span>
          </div>
          <div className="flex items-center gap-1.5">
            {['Summarize so far', 'Suggest next question', 'List action items'].map((chip) => (
              <button
                key={chip}
                onClick={() => handleAsk(chip)}
                disabled={isAsking}
                className="px-2 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.length === 0 && !streamingAnswer && (
            <div className="text-center text-[var(--text-muted)] py-12 space-y-2">
              <p>Ask anything about the live conversation or captured screen content.</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-xl max-w-[90%] whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-sky-500/15 border border-sky-500/25 text-[var(--text-primary)]'
                  : 'mr-auto bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}
            >
              <div className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">
                {m.role === 'user' ? 'You' : 'OpenClue AI'}
              </div>
              {m.content}
            </div>
          ))}
          {streamingAnswer && (
            <div className="mr-auto p-3.5 rounded-xl max-w-[90%] bg-[var(--bg-elevated)] border border-sky-500/30 whitespace-pre-wrap leading-relaxed">
              <div className="text-[10px] font-semibold uppercase text-sky-400 mb-1">OpenClue AI (streaming)</div>
              {streamingAnswer}
            </div>
          )}
          {aiError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeScreen}
                onChange={(e) => setIncludeScreen(e.target.checked)}
                className="accent-sky-500"
              />
              Include latest screen OCR context
            </label>
            <span>Provider: {settings?.ai_provider} / {settings?.ai_model}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Ask a question about the conversation or screen..."
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => handleAsk()}
              disabled={isAsking || !input.trim()}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
