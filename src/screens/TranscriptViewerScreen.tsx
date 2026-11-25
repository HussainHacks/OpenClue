import React, { useState } from 'react';
import { Download, Search, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const TranscriptViewerScreen: React.FC = () => {
  const { activeSession, transcripts, summary, generateSummary } = useAppStore();
  const [filter, setFilter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  if (!activeSession) {
    return (
      <div className="p-10 text-center text-xs text-[var(--text-muted)]">
        Select a session from Dashboard or Session History to view its transcript and meeting intelligence.
      </div>
    );
  }

  const filtered = filter.trim()
    ? transcripts.filter((t) => t.text.toLowerCase().includes(filter.toLowerCase()))
    : transcripts;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateSummary();
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (fmt: 'md' | 'txt' | 'pdf') => {
    setExportNote(null);
    if (fmt === 'pdf') {
      const md = await api.exportSessionText(activeSession.id, 'md');
      const saved = await window.openclue?.exportPdfFile(activeSession.title, md);
      if (saved) setExportNote(`Saved PDF to ${saved}`);
    } else {
      const content = await api.exportSessionText(activeSession.id, fmt);
      const saved = await window.openclue?.exportTextFile(activeSession.title, content, fmt);
      if (saved) setExportNote(`Saved ${fmt.toUpperCase()} to ${saved}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{activeSession.title}</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {transcripts.length} segments · {new Date(activeSession.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generating ? 'Analyzing...' : 'Generate Intelligence'}
          </button>
          {(['md', 'txt', 'pdf'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium uppercase"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {exportNote && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
          {exportNote}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Transcript Column */}
        <div className="lg:col-span-7 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col max-h-[70vh]">
          <div className="p-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter transcript..."
              className="flex-1 bg-transparent text-xs focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {filtered.length === 0 ? (
              <div className="text-[var(--text-muted)] text-center py-8">No transcript segments match.</div>
            ) : (
              filtered.map((t, idx) => (
                <div key={t.id || idx} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">{formatMs(t.timestamp_ms)}</span>
                    <span className="font-semibold text-sky-400">{t.speaker}</span>
                  </div>
                  <p className="text-[var(--text-primary)] leading-relaxed">{t.text}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Meeting Intelligence Column */}
        <div className="lg:col-span-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          <h2 className="text-sm font-semibold">Meeting Intelligence</h2>
          {!summary ? (
            <p className="text-[var(--text-muted)]">
              Click <strong>Generate Intelligence</strong> to extract a summary, key points, decisions, action items,
              and questions raised.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase text-sky-400 mb-1">Summary</div>
                <p className="text-[var(--text-secondary)] leading-relaxed">{summary.summary}</p>
              </div>
              {summary.key_points.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-indigo-400 mb-1">Key Discussion Points</div>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                    {summary.key_points.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {summary.decisions.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-emerald-400 mb-1">Decisions</div>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                    {summary.decisions.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {summary.action_items.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-amber-400 mb-1">Action Items</div>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                    {summary.action_items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
              {summary.questions_raised.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase text-rose-400 mb-1">Questions Raised</div>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--text-secondary)]">
                    {summary.questions_raised.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
