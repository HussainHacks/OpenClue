import React from 'react';
import { ArrowRight, CheckCircle2, Cpu, Mic, Monitor, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { OpenClueLogo } from '../components/Logo';

export const OnboardingScreen: React.FC = () => {
  const { updateSettings, setScreen, setPrivacyMode, privacyStatus } = useAppStore();

  const finishOnboarding = async () => {
    await updateSettings({ onboarding_completed: true });
    setScreen('dashboard');
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 space-y-8">
      <div className="flex items-center gap-4">
        <OpenClueLogo size={48} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to OpenClue</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            A transparent, local-first desktop AI assistant for meetings, research, and live conversations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <Mic className="w-4 h-4" />
            Real-Time Audio & Whisper
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Captures your microphone and system audio (WASAPI loopback on Windows) only when you start a session.
            Transcribes locally with Faster-Whisper.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <Monitor className="w-4 h-4" />
            Explicit Screen Context
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Screen OCR is disabled by default. When you enable it, OpenClue reads only the monitor or window you
            choose to answer questions about visible content.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            Screen-Sharing Privacy Mode
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Uses OS-approved capture exclusion ({privacyStatus.mechanism}) so your private assistant notes stay out of
            meeting screen shares.
          </p>
          <label className="flex items-center gap-2 pt-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={privacyStatus.enabled}
              onChange={(e) => setPrivacyMode(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>Keep Screen-Sharing Privacy Mode enabled</span>
          </label>
        </div>

        <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <Cpu className="w-4 h-4" />
            Local or Cloud AI Models
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Run 100% locally with Ollama, or connect your own OpenAI, Anthropic, or Gemini API keys encrypted in your OS
            credential vault.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>No telemetry, no hardcoded keys, and one-click local data deletion at any time.</span>
        </div>
        <button
          onClick={finishOnboarding}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors shrink-0"
        >
          Open Workspace
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
