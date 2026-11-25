import { contextBridge, ipcRenderer } from 'electron';

export interface BackendInfo {
  port: number;
  token: string;
}

export interface PrivacyStatus {
  enabled: boolean;
  supported: boolean;
  mechanism: string;
}

contextBridge.exposeInMainWorld('openclue', {
  getBackendInfo: (): Promise<BackendInfo> => ipcRenderer.invoke('get-backend-info'),
  toggleOverlay: (show?: boolean): Promise<boolean> => ipcRenderer.invoke('toggle-overlay', show),
  setOverlayBounds: (width: number, height: number): Promise<void> =>
    ipcRenderer.invoke('set-overlay-bounds', width, height),
  setAlwaysOnTop: (flag: boolean): Promise<boolean> => ipcRenderer.invoke('set-always-on-top', flag),
  getPrivacyStatus: (): Promise<PrivacyStatus> => ipcRenderer.invoke('get-privacy-status'),
  setPrivacyMode: (enabled: boolean): Promise<PrivacyStatus> => ipcRenderer.invoke('set-privacy-mode', enabled),
  getStoredKeyProviders: (): Promise<string[]> => ipcRenderer.invoke('get-stored-key-providers'),
  setProviderApiKey: (provider: string, key: string): Promise<string[]> =>
    ipcRenderer.invoke('set-provider-api-key', provider, key),
  clearAllApiKeys: (): Promise<string[]> => ipcRenderer.invoke('clear-all-api-keys'),
  exportTextFile: (defaultName: string, content: string, ext: 'md' | 'txt'): Promise<string | null> =>
    ipcRenderer.invoke('export-text-file', defaultName, content, ext),
  exportPdfFile: (title: string, markdownContent: string): Promise<string | null> =>
    ipcRenderer.invoke('export-pdf-file', title, markdownContent),
  focusMainWindow: (screen?: string): Promise<void> => ipcRenderer.invoke('focus-main-window', screen),
  onShortcutEvent: (callback: (eventName: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, name: string) => callback(name);
    ipcRenderer.on('shortcut-event', handler);
    return () => ipcRenderer.removeListener('shortcut-event', handler);
  },
  onPrivacyChanged: (callback: (status: PrivacyStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PrivacyStatus) => callback(status);
    ipcRenderer.on('privacy-changed', handler);
    return () => ipcRenderer.removeListener('privacy-changed', handler);
  },
});
