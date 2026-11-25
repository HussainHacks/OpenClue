import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { AudioDevicesResponse } from '../types';

export const AudioSettingsScreen: React.FC = () => {
  const { settings, updateSettings, micLevel, systemLevel, capturing } = useAppStore();
  const [devices, setDevices] = useState<AudioDevicesResponse | null>(null);

  const loadDevices = async () => {
    try {
      setDevices(await api.getAudioDevices());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Audio & Microphone Settings</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Configure microphone input, Windows WASAPI system loopback, and voice activity detection.
          </p>
        </div>
        <button
          onClick={loadDevices}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Devices
        </button>
      </div>

      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-4 text-xs">
        <div>
          <label className="font-semibold block mb-1.5">Microphone Input Device</label>
          <select
            value={settings?.mic_device_id ?? ''}
            onChange={(e) =>
              updateSettings({ mic_device_id: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
          >
            <option value="">System Default Microphone</option>
            {devices?.microphones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.hostapi || 'Audio'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
          <div>
            <div className="font-semibold">System Audio Capture (WASAPI Loopback)</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {devices?.system_audio_supported
                ? `Supported on Windows (${devices.loopback_devices.length} loopback endpoints detected).`
                : 'System audio loopback is not supported on this host.'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settings?.capture_system_audio)}
            onChange={(e) => updateSettings({ capture_system_audio: e.target.checked })}
            className="accent-sky-500 w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[var(--border-subtle)]">
          <div>
            <div className="font-semibold">Noise Gate / Reduction</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Attenuate low-level background fan or room noise below the speech threshold.
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settings?.noise_reduction)}
            onChange={(e) => updateSettings({ noise_reduction: e.target.checked })}
            className="accent-sky-500 w-4 h-4"
          />
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
          <div className="flex justify-between">
            <span className="font-semibold">VAD Sensitivity Threshold</span>
            <span className="font-mono text-[11px] text-sky-400">{settings?.vad_threshold ?? 0.015}</span>
          </div>
          <input
            type="range"
            min="0.005"
            max="0.06"
            step="0.002"
            value={settings?.vad_threshold ?? 0.015}
            onChange={(e) => updateSettings({ vad_threshold: Number(e.target.value) })}
            className="w-full accent-sky-500"
          />
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="font-semibold">Live Input Monitor {capturing ? '(Active)' : '(Start Listening to meter)'}</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-16 text-[11px] text-[var(--text-muted)]">Mic</span>
              <div className="flex-1 h-2 rounded bg-[var(--bg-primary)] overflow-hidden">
                <div className="h-full bg-sky-400 transition-all duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-[11px] text-[var(--text-muted)]">System</span>
              <div className="flex-1 h-2 rounded bg-[var(--bg-primary)] overflow-hidden">
                <div className="h-full bg-indigo-400 transition-all duration-75" style={{ width: `${Math.round(systemLevel * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
