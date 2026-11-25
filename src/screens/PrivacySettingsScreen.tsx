import React, { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export const PrivacySettingsScreen: React.FC = () => {
  const { settings, updateSettings, refreshSessions, refreshStoredKeys } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleDeleteAll = async () => {
    await api.deleteAllData();
    await window.openclue?.clearAllApiKeys();
    await refreshSessions();
    await refreshStoredKeys();
    setConfirmDelete(false);
    setStatusMsg('All local sessions, transcripts, reference documents, and API keys have been deleted.');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Privacy & Data Management</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Control retention, review what leaves your device, and permanently delete local data.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs">
          {statusMsg}
        </div>
      )}

      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3 text-xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-sky-400">
          <ShieldCheck className="w-4 h-4" />
          Data Flow Transparency
        </div>
        <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-secondary)]">
          <li>
            <strong>Audio & Transcription:</strong> Processed locally on your CPU by Faster-Whisper unless you switch
            Transcription Engine to OpenAI Whisper API.
          </li>
          <li>
            <strong>Screen Context OCR:</strong> Extracted locally on your CPU by RapidOCR. Raw screenshots are never
            uploaded to any server.
          </li>
          <li>
            <strong>AI Assistant Prompts:</strong> Sent to local Ollama by default. Only sent to OpenAI, Anthropic, or
            Google Gemini when you explicitly select that provider and enter your own API key.
          </li>
          <li>
            <strong>Telemetry:</strong> OpenClue collects zero analytics or usage telemetry.
          </li>
        </ul>
      </div>

      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3 text-xs">
        <h2 className="text-sm font-semibold">Local Data Retention</h2>
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">Automatically delete sessions older than:</span>
          <select
            value={settings?.retention_days ?? 30}
            onChange={(e) => updateSettings({ retention_days: Number(e.target.value) })}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={0}>Keep indefinitely</option>
          </select>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-3 text-xs">
        <h2 className="text-sm font-semibold text-rose-400">Danger Zone</h2>
        <p className="text-[var(--text-secondary)]">
          Permanently erase all local sessions, transcripts, summaries, reference documents, and stored API keys.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete All Local Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAll}
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Confirm Permanent Deletion
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
