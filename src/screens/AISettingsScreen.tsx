import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { ReferenceDoc } from '../types';

export const AISettingsScreen: React.FC = () => {
  const { settings, updateSettings, activeSession, selectSession } = useAppStore();
  const [sysInstr, setSysInstr] = useState(settings?.system_instructions ?? '');
  const [length, setLength] = useState(settings?.response_length ?? 'balanced');
  const [style, setStyle] = useState(settings?.response_style ?? 'professional');
  const [bg, setBg] = useState(settings?.professional_background ?? '');
  const [proj, setProj] = useState(settings?.project_context ?? '');
  const [sessionInstr, setSessionInstr] = useState(activeSession?.custom_instructions ?? '');
  const [saved, setSaved] = useState(false);

  const [docs, setDocs] = useState<ReferenceDoc[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');

  useEffect(() => {
    api.listReferenceDocs().then(setDocs).catch(() => {});
  }, []);

  const handleSave = async () => {
    await updateSettings({
      system_instructions: sysInstr,
      response_length: length,
      response_style: style,
      professional_background: bg,
      project_context: proj,
    });
    if (activeSession) {
      await api.updateSession(activeSession.id, { custom_instructions: sessionInstr });
      await selectSession(activeSession.id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddDoc = async () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    await api.addReferenceDoc(docTitle.trim(), docContent.trim());
    setDocTitle('');
    setDocContent('');
    setDocs(await api.listReferenceDocs());
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI Behavior & Context</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Customize instructions, tone, background, and local reference documents.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold"
        >
          <Save className="w-3.5 h-3.5" />
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <label className="text-xs font-semibold">Response Length</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as typeof length)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="concise">Concise (bullet points)</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <label className="text-xs font-semibold">Response Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as typeof style)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-xs"
          >
            <option value="professional">Professional</option>
            <option value="technical">Technical & Direct</option>
            <option value="executive">Executive Summary</option>
            <option value="casual">Casual & Conversational</option>
          </select>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3 text-xs">
        <div>
          <label className="font-semibold block mb-1">Personal AI Instructions</label>
          <textarea
            rows={3}
            value={sysInstr}
            onChange={(e) => setSysInstr(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="font-semibold block mb-1">Professional Background</label>
          <textarea
            rows={2}
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            placeholder="e.g., Senior Backend Engineer working on distributed systems..."
            className="w-full p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="font-semibold block mb-1">Project Context</label>
          <textarea
            rows={2}
            value={proj}
            onChange={(e) => setProj(e.target.value)}
            placeholder="e.g., Q4 migration to event-driven architecture..."
            className="w-full p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-sky-500"
          />
        </div>
        {activeSession && (
          <div>
            <label className="font-semibold block mb-1">
              Session-Specific Instructions ({activeSession.title})
            </label>
            <textarea
              rows={2}
              value={sessionInstr}
              onChange={(e) => setSessionInstr(e.target.value)}
              placeholder="Optional instructions specific to the current session..."
              className="w-full p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] focus:outline-none focus:border-sky-500"
            />
          </div>
        )}
      </div>

      {/* Reference Documents */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3 text-xs">
        <h2 className="text-sm font-semibold">Custom Reference Documents (Stored Locally)</h2>
        <div className="space-y-2">
          <input
            type="text"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Document title (e.g., Product FAQ, Architecture Notes)"
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
          />
          <textarea
            rows={3}
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste reference text..."
            className="w-full p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
          />
          <button
            onClick={handleAddDoc}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] font-medium"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            Add Reference Document
          </button>
        </div>

        {docs.length > 0 && (
          <div className="divide-y divide-[var(--border-subtle)] pt-2">
            {docs.map((d) => (
              <div key={d.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{d.content.length} chars</div>
                </div>
                <button
                  onClick={async () => {
                    await api.deleteReferenceDoc(d.id);
                    setDocs(await api.listReferenceDocs());
                  }}
                  className="p-1.5 rounded hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
