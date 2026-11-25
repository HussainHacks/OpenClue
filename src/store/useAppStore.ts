import { create } from 'zustand';
import { api, connectLiveWebSocket } from '../lib/api';
import type {
  AppSettings,
  ChatMessage,
  MeetingSummary,
  PrivacyStatus,
  ScreenCaptureResult,
  ScreenId,
  Session,
  TranscriptSegment,
} from '../types';

interface AppState {
  ready: boolean;
  screen: ScreenId;
  settings: AppSettings | null;
  sessions: Session[];
  activeSession: Session | null;
  transcripts: TranscriptSegment[];
  partialTranscript: TranscriptSegment | null;
  messages: ChatMessage[];
  summary: MeetingSummary | null;
  streamingAnswer: string;
  isAsking: boolean;
  aiError: string | null;

  capturing: boolean;
  paused: boolean;
  micLevel: number;
  systemLevel: number;
  audioError: string | null;

  latestScreen: ScreenCaptureResult | null;
  privacyStatus: PrivacyStatus;
  storedKeyProviders: string[];

  init: () => Promise<void>;
  setScreen: (screen: ScreenId) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  refreshSessions: (q?: string) => Promise<void>;
  createAndSelectSession: (title?: string, sessionType?: string, customInstructions?: string) => Promise<Session>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  startCapture: () => Promise<void>;
  pauseCapture: () => Promise<void>;
  resumeCapture: () => Promise<void>;
  stopCapture: () => Promise<void>;

  captureScreenNow: () => Promise<void>;
  askQuestion: (question: string, includeScreen?: boolean) => Promise<void>;
  generateSummary: () => Promise<void>;
  setPrivacyMode: (enabled: boolean) => Promise<void>;
  refreshStoredKeys: () => Promise<void>;
}

let wsInstance: WebSocket | null = null;
let screenTimer: number | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  screen: 'dashboard',
  settings: null,
  sessions: [],
  activeSession: null,
  transcripts: [],
  partialTranscript: null,
  messages: [],
  summary: null,
  streamingAnswer: '',
  isAsking: false,
  aiError: null,

  capturing: false,
  paused: false,
  micLevel: 0,
  systemLevel: 0,
  audioError: null,

  latestScreen: null,
  privacyStatus: { enabled: true, supported: true, mechanism: 'Win32 WDA_EXCLUDEFROMCAPTURE' },
  storedKeyProviders: [],

  init: async () => {
    try {
      const [settings, sessions] = await Promise.all([api.getSettings(), api.listSessions()]);
      document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

      const privacyStatus = window.openclue
        ? await window.openclue.getPrivacyStatus()
        : { enabled: settings.privacy_mode_enabled, supported: false, mechanism: 'Browser mode' };
      const storedKeyProviders = window.openclue ? await window.openclue.getStoredKeyProviders() : [];

      set({
        ready: true,
        settings,
        sessions,
        screen: settings.onboarding_completed ? 'dashboard' : 'onboarding',
        privacyStatus,
        storedKeyProviders,
      });

      if (sessions.length > 0 && !get().activeSession) {
        await get().selectSession(sessions[0].id);
      }

      // Connect WebSocket for real-time audio & transcript events
      if (!wsInstance) {
        wsInstance = await connectLiveWebSocket((ev) => {
          if (ev.type === 'audio_levels') {
            set({ micLevel: Number(ev.mic_level || 0), systemLevel: Number(ev.system_level || 0) });
          } else if (ev.type === 'audio_status' && ev.status) {
            const st = ev.status as { capturing: boolean; paused: boolean };
            set({ capturing: st.capturing, paused: st.paused });
          } else if (ev.type === 'transcript_partial' && ev.segment) {
            set({ partialTranscript: ev.segment as TranscriptSegment });
          } else if (ev.type === 'transcript_final' && ev.segment) {
            const seg = ev.segment as TranscriptSegment;
            const active = get().activeSession;
            if (active && seg.session_id === active.id) {
              set((s) => ({
                transcripts: [...s.transcripts, seg],
                partialTranscript: null,
              }));
            }
          }
        });
      }

      if (window.openclue) {
        window.openclue.onPrivacyChanged((status) => set({ privacyStatus: status }));
        window.openclue.onShortcutEvent((evName) => {
          if (evName === 'toggle-mic') {
            const st = get();
            if (st.capturing) st.stopCapture();
            else st.startCapture();
          } else if (evName.startsWith('navigate:')) {
            set({ screen: evName.split(':')[1] as ScreenId });
          }
        });
      }
    } catch (err) {
      console.error('Init failed:', err);
      set({ ready: true });
    }
  },

  setScreen: (screen) => set({ screen }),

  updateSettings: async (patch) => {
    const updated = await api.updateSettings(patch);
    document.documentElement.setAttribute('data-theme', updated.theme || 'dark');
    set({ settings: updated });

    // Manage interval screen capture cleanly
    if (screenTimer !== null) {
      window.clearInterval(screenTimer);
      screenTimer = null;
    }
    if (updated.screen_capture_enabled && updated.screen_capture_interval_sec > 0) {
      screenTimer = window.setInterval(() => {
        if (get().settings?.screen_capture_enabled) {
          get().captureScreenNow().catch(() => {});
        }
      }, updated.screen_capture_interval_sec * 1000);
    }
  },

  refreshSessions: async (q = '') => {
    const sessions = await api.listSessions(q);
    set({ sessions });
  },

  createAndSelectSession: async (title = 'New Session', sessionType = 'meeting', customInstructions = '') => {
    const created = await api.createSession(title, sessionType, customInstructions);
    await get().refreshSessions();
    set({
      activeSession: created,
      transcripts: [],
      partialTranscript: null,
      messages: [],
      summary: null,
    });
    return created;
  },

  selectSession: async (id) => {
    const detail = await api.getSessionDetail(id);
    set({
      activeSession: detail.session,
      transcripts: detail.transcripts,
      partialTranscript: null,
      messages: detail.messages,
      summary: detail.summary,
    });
  },

  deleteSession: async (id) => {
    await api.deleteSession(id);
    const sessions = await api.listSessions();
    const wasActive = get().activeSession?.id === id;
    set({ sessions });
    if (wasActive) {
      if (sessions.length > 0) {
        await get().selectSession(sessions[0].id);
      } else {
        set({ activeSession: null, transcripts: [], messages: [], summary: null });
      }
    }
  },

  startCapture: async () => {
    set({ audioError: null });
    let session = get().activeSession;
    if (!session) {
      session = await get().createAndSelectSession(
        `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      );
    }
    try {
      await api.startAudio(session.id);
      set({ capturing: true, paused: false });
    } catch (err) {
      set({ audioError: (err as Error).message });
    }
  },

  pauseCapture: async () => {
    await api.pauseAudio();
    set({ paused: true });
  },

  resumeCapture: async () => {
    await api.resumeAudio();
    set({ paused: false });
  },

  stopCapture: async () => {
    await api.stopAudio();
    set({ capturing: false, paused: false, micLevel: 0, systemLevel: 0, partialTranscript: null });
  },

  captureScreenNow: async () => {
    const settings = get().settings;
    const res = await api.captureScreen(
      settings?.selected_monitor_index ?? 1,
      settings?.selected_window_title ?? '',
    );
    set({ latestScreen: res });
  },

  askQuestion: async (question, includeScreen = true) => {
    if (!question.trim()) return;
    let session = get().activeSession;
    if (!session) {
      session = await get().createAndSelectSession(
        `Quick Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      );
    }
    set({ isAsking: true, streamingAnswer: '', aiError: null });

    const optimisticUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: session.id,
      role: 'user',
      content: question,
      screen_ocr_excerpt: '',
      created_at: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, optimisticUserMsg] }));

    let full = '';
    try {
      await api.askStreaming(session.id, question, includeScreen, (delta) => {
        full += delta;
        set({ streamingAnswer: full });
      });
      await get().selectSession(session.id);
    } catch (err) {
      set({ aiError: (err as Error).message });
    } finally {
      set({ isAsking: false, streamingAnswer: '' });
    }
  },

  generateSummary: async () => {
    const session = get().activeSession;
    if (!session) return;
    const summary = await api.generateSummary(session.id);
    set({ summary });
  },

  setPrivacyMode: async (enabled) => {
    if (window.openclue) {
      const status = await window.openclue.setPrivacyMode(enabled);
      set({ privacyStatus: status });
    }
    await get().updateSettings({ privacy_mode_enabled: enabled });
  },

  refreshStoredKeys: async () => {
    if (window.openclue) {
      const providers = await window.openclue.getStoredKeyProviders();
      set({ storedKeyProviders: providers });
    }
  },
}));
