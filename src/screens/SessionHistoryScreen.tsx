import React, { useState } from 'react';
import { Activity, FileText, Search, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const SessionHistoryScreen: React.FC = () => {
  const { sessions, refreshSessions, selectSession, deleteSession, setScreen } = useAppStore();
  const [query, setQuery] = useState('');

  const handleSearch = async (val: string) => {
    setQuery(val);
    await refreshSessions(val);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Session History</h1>
          <p className="text-xs text-[var(--text-secondary)]">Search past meetings, transcripts, and AI Q&A.</p>
        </div>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search titles or transcript text..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">No matching sessions found.</div>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)]/50 transition-colors">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{s.title}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {s.session_type} · {s.transcript_count ?? 0} transcript segments · {s.message_count ?? 0} AI messages ·{' '}
                  {new Date(s.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await selectSession(s.id);
                    setScreen('live');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  Resume
                </button>
                <button
                  onClick={async () => {
                    await selectSession(s.id);
                    setScreen('transcript');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-xs font-medium flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  View & Export
                </button>
                <button
                  onClick={() => deleteSession(s.id)}
                  title="Delete Session"
                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
