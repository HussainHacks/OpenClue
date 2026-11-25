import React from 'react';
import {
  Activity,
  Bot,
  Cpu,
  FileText,
  History,
  LayoutDashboard,
  Mic,
  Monitor,
  PanelTop,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { ScreenId } from '../types';
import { OpenClueLogo } from './Logo';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Assistant', icon: Activity },
  { id: 'history', label: 'Session History', icon: History },
  { id: 'transcript', label: 'Transcript Viewer', icon: FileText },
];

const SETTINGS_NAV: NavItem[] = [
  { id: 'ai-settings', label: 'AI Behavior', icon: Bot },
  { id: 'audio-settings', label: 'Audio & Mic', icon: Mic },
  { id: 'screen-settings', label: 'Screen Context', icon: Monitor },
  { id: 'provider-settings', label: 'Model Providers', icon: Cpu },
  { id: 'privacy-settings', label: 'Privacy & Data', icon: ShieldCheck },
];

export const Sidebar: React.FC = () => {
  const { screen, setScreen, settings, updateSettings, privacyStatus, setPrivacyMode } = useAppStore();
  const isDark = (settings?.theme ?? 'dark') === 'dark';

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] select-none">
      {/* Brand */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <OpenClueLogo size={28} />
          <div>
            <div className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">OpenClue</div>
            <div className="text-[11px] text-[var(--text-muted)]">Local-First Assistant</div>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
          title="Toggle Theme"
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Overlay Launch */}
      <div className="px-3 pt-3">
        <button
          onClick={() => window.openclue?.toggleOverlay()}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sky-500/12 hover:bg-sky-500/20 border border-sky-500/25 text-sky-400 text-xs font-medium transition-colors"
        >
          <span className="flex items-center gap-2">
            <PanelTop className="w-3.5 h-3.5" />
            Floating Overlay
          </span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-black/25 text-sky-300">Ctrl+Shift+Space</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div>
          <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Workspace
          </div>
          <div className="space-y-0.5">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-sky-400' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Configuration
          </div>
          <div className="space-y-0.5">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-sky-400' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Privacy & Onboarding Footer */}
      <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
        <button
          onClick={() => setPrivacyMode(!privacyStatus.enabled)}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs border transition-colors ${
            privacyStatus.enabled
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
          }`}
          title={privacyStatus.mechanism}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Share Privacy
          </span>
          <span className="text-[10px] font-semibold uppercase">
            {privacyStatus.enabled ? 'Protected' : 'Visible'}
          </span>
        </button>

        <button
          onClick={() => setScreen('onboarding')}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Setup Guide
        </button>
      </div>
    </aside>
  );
};
