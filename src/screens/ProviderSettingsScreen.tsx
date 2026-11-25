import React, { useEffect, useState } from 'react';
import { Check, KeyRound, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export const ProviderSettingsScreen: React.FC = () => {
  const { settings, updateSettings, storedKeyProviders, refreshStoredKeys } = useAppStore();
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState(false);

  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const checkOllama = async () => {
    try {
      const res = await api.getOllamaModels();
      setOllamaModels(res.models);
      setOllamaOnline(res.available);
    } catch {
      setOllamaOnline(false);
    }
  };

  useEffect(() => {
    checkOllama();
  }, []);

  const saveKey = async (provider: string, key: string) => {
    if (!window.openclue) return;
    await window.openclue.setProviderApiKey(provider, key);
    await refreshStoredKeys();
    setSavedMsg(`${provider} API key encrypted and stored in OS vault.`);
    setTimeout(() => setSavedMsg(null), 2500);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Model Provider Settings</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Run locally with Ollama & Faster-Whisper, or configure cloud API keys encrypted via Windows DPAPI / OS Keychain.
        </p>
      </div>

      {/* Active LLM Provider */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">AI Assistant Provider</h2>
          <button
            onClick={checkOllama}
            className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            Ollama: {ollamaOnline ? `Online (${ollamaModels.length} models)` : 'Offline'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold block mb-1">Provider</label>
            <select
              value={settings?.ai_provider ?? 'ollama'}
              onChange={(e) => {
                const p = e.target.value as 'ollama' | 'openai' | 'anthropic' | 'gemini';
                const defaultModel =
                  p === 'ollama'
                    ? ollamaModels[0] || 'llama3.2'
                    : p === 'openai'
                      ? 'gpt-4o-mini'
                      : p === 'anthropic'
                        ? 'claude-3-5-sonnet-latest'
                        : 'gemini-2.5-flash';
                updateSettings({ ai_provider: p, ai_model: defaultModel });
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <option value="ollama">Ollama (Local, Free)</option>
              <option value="openai">OpenAI API</option>
              <option value="anthropic">Anthropic API</option>
              <option value="gemini">Google Gemini API</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Model Name</label>
            {settings?.ai_provider === 'ollama' && ollamaModels.length > 0 ? (
              <select
                value={settings.ai_model}
                onChange={(e) => updateSettings({ ai_model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
              >
                {ollamaModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings?.ai_model ?? ''}
                onChange={(e) => updateSettings({ ai_model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
              />
            )}
          </div>
        </div>
      </div>

      {/* Transcription Settings */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4 text-xs">
        <h2 className="text-sm font-semibold">Speech-to-Text (Whisper)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-semibold block mb-1">Engine</label>
            <select
              value={settings?.transcription_provider ?? 'local'}
              onChange={(e) => updateSettings({ transcription_provider: e.target.value as 'local' | 'openai' })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <option value="local">Local Faster-Whisper (CPU int8)</option>
              <option value="openai">OpenAI Whisper API</option>
            </select>
          </div>
          <div>
            <label className="font-semibold block mb-1">Whisper Model</label>
            <select
              value={settings?.whisper_model ?? 'base.en'}
              onChange={(e) => updateSettings({ whisper_model: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <option value="tiny.en">tiny.en (Fastest, ~75MB)</option>
              <option value="base.en">base.en (Balanced, ~145MB)</option>
              <option value="small.en">small.en (Accurate, ~480MB)</option>
              <option value="base">base (Multilingual)</option>
              <option value="small">small (Multilingual)</option>
            </select>
          </div>
          <div>
            <label className="font-semibold block mb-1">Language</label>
            <select
              value={settings?.transcription_language ?? 'en'}
              onChange={(e) => updateSettings({ transcription_language: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
            >
              <option value="en">English (en)</option>
              <option value="auto">Auto-detect</option>
              <option value="es">Spanish (es)</option>
              <option value="fr">French (fr)</option>
              <option value="de">German (de)</option>
              <option value="ja">Japanese (ja)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Encrypted API Key Vault */}
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold">OS-Encrypted API Key Vault</h2>
        </div>
        {savedMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            {savedMsg}
          </div>
        )}

        {[
          { id: 'openai', label: 'OpenAI API Key', val: openaiKey, setVal: setOpenaiKey },
          { id: 'anthropic', label: 'Anthropic API Key', val: anthropicKey, setVal: setAnthropicKey },
          { id: 'gemini', label: 'Google Gemini API Key', val: geminiKey, setVal: setGeminiKey },
        ].map((item) => {
          const isStored = storedKeyProviders.includes(item.id);
          return (
            <div key={item.id} className="flex flex-wrap items-center gap-2">
              <div className="w-44 font-medium flex items-center gap-2">
                {item.label}
                {isStored && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                    Stored
                  </span>
                )}
              </div>
              <input
                type="password"
                value={item.val}
                onChange={(e) => item.setVal(e.target.value)}
                placeholder={isStored ? '•••••••••••••••• (enter new key to replace)' : 'Paste API key...'}
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
              />
              <button
                onClick={() => saveKey(item.id, item.val)}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold"
              >
                Save
              </button>
              {isStored && (
                <button
                  onClick={() => saveKey(item.id, '')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
