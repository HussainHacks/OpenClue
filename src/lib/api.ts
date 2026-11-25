import type {
  AppSettings,
  AudioDevicesResponse,
  ChatMessage,
  MeetingSummary,
  ReferenceDoc,
  ScreenCaptureResult,
  ScreenSourceMonitor,
  ScreenSourceWindow,
  Session,
  TranscriptSegment,
} from '../types';

let cachedBaseUrl = 'http://127.0.0.1:8765';
let cachedToken = '';
let initialized = false;

export async function initApiConnection(): Promise<{ baseUrl: string; token: string }> {
  if (!initialized && window.openclue) {
    const info = await window.openclue.getBackendInfo();
    cachedBaseUrl = `http://127.0.0.1:${info.port}`;
    cachedToken = info.token;
    initialized = true;
  }
  return { baseUrl: cachedBaseUrl, token: cachedToken };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, token } = await initApiConnection();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      if (j.detail) msg = j.detail;
    } catch {
      // keep raw
    }
    throw new Error(msg || `HTTP ${resp.status}`);
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await resp.json()) as T;
  }
  return (await resp.text()) as unknown as T;
}

export const api = {
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),

  getAudioDevices: () => request<AudioDevicesResponse>('/audio/devices'),
  startAudio: (session_id: string) =>
    request('/audio/start', { method: 'POST', body: JSON.stringify({ session_id }) }),
  pauseAudio: () => request('/audio/pause', { method: 'POST' }),
  resumeAudio: () => request('/audio/resume', { method: 'POST' }),
  stopAudio: () => request('/audio/stop', { method: 'POST' }),

  getScreenSources: () =>
    request<{
      monitors: ScreenSourceMonitor[];
      windows: ScreenSourceWindow[];
      window_listing_supported?: boolean;
      window_listing_reason?: string;
    }>('/screen/sources'),
  captureScreen: (monitor_index: number, window_title: string) =>
    request<ScreenCaptureResult>('/screen/capture', {
      method: 'POST',
      body: JSON.stringify({ monitor_index, window_title }),
    }),
  getLatestScreen: () => request<ScreenCaptureResult>('/screen/latest'),
  clearScreen: () => request('/screen/clear', { method: 'POST' }),

  listSessions: (q = '') => request<Session[]>(`/sessions?q=${encodeURIComponent(q)}`),
  createSession: (title: string, session_type = 'meeting', custom_instructions = '') =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, session_type, custom_instructions }),
    }),
  getSessionDetail: (id: string) =>
    request<{
      session: Session;
      transcripts: TranscriptSegment[];
      messages: ChatMessage[];
      summary: MeetingSummary | null;
    }>(`/sessions/${id}`),
  updateSession: (id: string, patch: Partial<Session>) =>
    request<Session>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteSession: (id: string) => request<{ deleted: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),
  searchTranscripts: (q: string) =>
    request<Array<TranscriptSegment & { session_title: string }>>(`/search?q=${encodeURIComponent(q)}`),

  generateSummary: (sessionId: string) =>
    request<MeetingSummary>(`/sessions/${sessionId}/summary`, { method: 'POST' }),
  exportSessionText: (sessionId: string, fmt: 'md' | 'txt') =>
    request<string>(`/sessions/${sessionId}/export?fmt=${fmt}`),

  listReferenceDocs: () => request<ReferenceDoc[]>('/reference-docs'),
  addReferenceDoc: (title: string, content: string) =>
    request<ReferenceDoc>('/reference-docs', { method: 'POST', body: JSON.stringify({ title, content }) }),
  deleteReferenceDoc: (id: string) => request(`/reference-docs/${id}`, { method: 'DELETE' }),

  getOllamaModels: () => request<{ models: string[]; available: boolean }>('/ai/ollama/models'),
  deleteAllData: () => request('/data/all', { method: 'DELETE' }),

  async askStreaming(
    sessionId: string,
    question: string,
    includeScreenContext: boolean,
    onDelta: (text: string) => void,
  ): Promise<void> {
    const { baseUrl, token } = await initApiConnection();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(`${baseUrl}/sessions/${sessionId}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, include_screen_context: includeScreenContext }),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`AI request failed (${resp.status})`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.error) throw new Error(payload.error);
        if (payload.delta) onDelta(payload.delta);
      }
    }
  },
};

export async function connectLiveWebSocket(onEvent: (ev: Record<string, unknown>) => void): Promise<WebSocket> {
  const { baseUrl, token } = await initApiConnection();
  const wsUrl = baseUrl.replace('http://', 'ws://') + `/ws/live${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      // ignore malformed
    }
  };
  return ws;
}
