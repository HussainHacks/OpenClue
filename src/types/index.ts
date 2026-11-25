export type ScreenId =
  | 'onboarding'
  | 'dashboard'
  | 'live'
  | 'history'
  | 'transcript'
  | 'ai-settings'
  | 'audio-settings'
  | 'screen-settings'
  | 'provider-settings'
  | 'privacy-settings';

export interface AppSettings {
  onboarding_completed: boolean;
  theme: 'dark' | 'light';
  ai_provider: 'ollama' | 'openai' | 'anthropic' | 'gemini';
  ai_model: string;
  ollama_base_url: string;
  system_instructions: string;
  response_length: 'concise' | 'balanced' | 'detailed';
  response_style: 'professional' | 'casual' | 'technical' | 'executive';
  professional_background: string;
  project_context: string;
  whisper_model: string;
  transcription_provider: 'local' | 'openai';
  transcription_language: string;
  mic_device_id: number | null;
  capture_system_audio: boolean;
  noise_reduction: boolean;
  vad_threshold: number;
  screen_capture_enabled: boolean;
  screen_capture_interval_sec: number;
  selected_monitor_index: number;
  selected_window_title: string;
  privacy_mode_enabled: boolean;
  retention_days: number;
}

export interface Session {
  id: string;
  title: string;
  session_type: string;
  custom_instructions: string;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  transcript_count?: number;
  message_count?: number;
}

export interface TranscriptSegment {
  id?: string;
  session_id: string;
  speaker: string;
  text: string;
  is_final: boolean;
  timestamp_ms: number;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  screen_ocr_excerpt: string;
  created_at: string;
}

export interface MeetingSummary {
  session_id: string;
  summary: string;
  key_points: string[];
  decisions: string[];
  action_items: string[];
  questions_raised: string[];
  important_timestamps: string[];
  updated_at: string;
}

export interface ReferenceDoc {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface AudioDevice {
  id: number;
  name: string;
  hostapi?: string;
  channels: number;
  sample_rate: number;
  is_default: boolean;
}

export interface AudioDevicesResponse {
  microphones: AudioDevice[];
  loopback_devices: AudioDevice[];
  system_audio_supported: boolean;
  platform: string;
}

export interface ScreenSourceMonitor {
  index: number;
  name: string;
  bounds: { left: number; top: number; width: number; height: number };
}

export interface ScreenSourceWindow {
  hwnd: number;
  title: string;
  bounds: { left: number; top: number; width: number; height: number };
}

export interface ScreenCaptureResult {
  ocr_text: string;
  source_label: string;
  captured_at: string;
  thumbnail_b64: string;
  char_count?: number;
}

export interface PrivacyStatus {
  enabled: boolean;
  supported: boolean;
  mechanism: string;
}

declare global {
  interface Window {
    openclue?: {
      getBackendInfo: () => Promise<{ port: number; token: string }>;
      toggleOverlay: (show?: boolean) => Promise<boolean>;
      setOverlayBounds: (width: number, height: number) => Promise<void>;
      setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
      getPrivacyStatus: () => Promise<PrivacyStatus>;
      setPrivacyMode: (enabled: boolean) => Promise<PrivacyStatus>;
      getStoredKeyProviders: () => Promise<string[]>;
      setProviderApiKey: (provider: string, key: string) => Promise<string[]>;
      clearAllApiKeys: () => Promise<string[]>;
      exportTextFile: (defaultName: string, content: string, ext: 'md' | 'txt') => Promise<string | null>;
      exportPdfFile: (title: string, markdownContent: string) => Promise<string | null>;
      focusMainWindow: (screen?: string) => Promise<void>;
      onShortcutEvent: (cb: (eventName: string) => void) => () => void;
      onPrivacyChanged: (cb: (status: PrivacyStatus) => void) => () => void;
    };
  }
}
