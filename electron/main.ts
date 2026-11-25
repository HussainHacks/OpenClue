import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  safeStorage,
  screen,
} from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as net from 'net';
import * as path from 'path';
import { exportMarkdownAsPdf } from './pdfExport';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendPort = 8765;
const apiToken = crypto.randomBytes(24).toString('hex');
let privacyModeEnabled = true;

const isDev = !app.isPackaged;

function getPrivacySupport(): { supported: boolean; mechanism: string } {
  if (process.platform === 'win32') {
    return {
      supported: true,
      mechanism: 'Win32 SetWindowDisplayAffinity (WDA_EXCLUDEFROMCAPTURE)',
    };
  }
  if (process.platform === 'darwin') {
    return {
      supported: true,
      mechanism: 'macOS NSWindow.SharingType.none',
    };
  }
  return {
    supported: false,
    mechanism: 'OS capture exclusion unavailable on this platform (using separate window isolation)',
  };
}

function getPrivacyStatus() {
  const { supported, mechanism } = getPrivacySupport();
  return { enabled: privacyModeEnabled, supported, mechanism };
}

function applyPrivacyMode(enabled: boolean) {
  privacyModeEnabled = enabled;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setContentProtection(enabled);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setContentProtection(enabled);
  }
  const status = getPrivacyStatus();
  mainWindow?.webContents.send('privacy-changed', status);
  overlayWindow?.webContents.send('privacy-changed', status);
  return status;
}

function getVaultPath(): string {
  return path.join(app.getPath('userData'), 'vault.bin');
}

async function loadVaultKeys(): Promise<Record<string, string>> {
  const vaultPath = getVaultPath();
  if (!fs.existsSync(vaultPath)) {
    return {};
  }
  try {
    const raw = await fsp.readFile(vaultPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    const decrypted: Record<string, string> = {};
    for (const [provider, b64] of Object.entries(parsed)) {
      if (!b64) continue;
      if (safeStorage.isEncryptionAvailable()) {
        decrypted[provider] = safeStorage.decryptString(Buffer.from(b64, 'base64'));
      } else {
        decrypted[provider] = Buffer.from(b64, 'base64').toString('utf8');
      }
    }
    return decrypted;
  } catch {
    return {};
  }
}

async function saveVaultKeys(keys: Record<string, string>): Promise<void> {
  const encrypted: Record<string, string> = {};
  for (const [provider, val] of Object.entries(keys)) {
    if (!val) continue;
    if (safeStorage.isEncryptionAvailable()) {
      encrypted[provider] = safeStorage.encryptString(val).toString('base64');
    } else {
      encrypted[provider] = Buffer.from(val, 'utf8').toString('base64');
    }
  }
  await fsp.mkdir(app.getPath('userData'), { recursive: true });
  await fsp.writeFile(getVaultPath(), JSON.stringify(encrypted, null, 2), 'utf8');
}

async function syncKeysToBackend(keys: Record<string, string>): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${backendPort}/runtime-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ keys }),
    });
  } catch {
    // Backend may still be booting; ignored until ready
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => {
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        } else {
          reject(new Error('Could not allocate port'));
        }
      });
    });
  });
}

function resolvePythonExecutable(backendDir: string): string {
  const winCandidate = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  const unixCandidate = path.join(backendDir, '.venv', 'bin', 'python');
  const candidates =
    process.platform === 'win32'
      ? [winCandidate, unixCandidate]
      : [unixCandidate, winCandidate];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

async function startPythonBackend(): Promise<void> {
  backendPort = await findFreePort();
  const backendDir = isDev
    ? path.join(app.getAppPath(), 'backend')
    : path.join(process.resourcesPath, 'backend');

  const pythonCmd = resolvePythonExecutable(backendDir);

  backendProcess = spawn(pythonCmd, ['main.py'], {
    cwd: backendDir,
    env: {
      ...process.env,
      OPENCLUE_PORT: String(backendPort),
      OPENCLUE_API_TOKEN: apiToken,
      OPENCLUE_DATA_DIR: app.getPath('userData'),
    },
    stdio: 'pipe',
  });

  backendProcess.stderr?.on('data', (chunk) => {
    if (isDev) {
      process.stderr.write(`[backend] ${chunk}`);
    }
  });

  // Wait for /health
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`http://127.0.0.1:${backendPort}/health`);
      if (resp.ok) {
        const keys = await loadVaultKeys();
        await syncKeysToBackend(keys);
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Python backend failed to start within 25 seconds.');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'OpenClue',
    backgroundColor: '#090b10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setContentProtection(privacyModeEnabled);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
  });
}

function createOverlayWindow(): void {
  const display = screen.getPrimaryDisplay();
  const width = 430;
  const height = 560;
  const x = display.workArea.x + display.workArea.width - width - 24;
  const y = display.workArea.y + 48;

  overlayWindow = new BrowserWindow({
    width,
    height,
    minWidth: 340,
    minHeight: 160,
    x,
    y,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    title: 'OpenClue Floating Assistant',
    backgroundColor: '#10131a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setContentProtection(privacyModeEnabled);

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173/overlay.html');
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/overlay.html'));
  }

  overlayWindow.on('close', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      overlayWindow?.hide();
    }
  });
}

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
      overlayWindow.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    applyPrivacyMode(!privacyModeEnabled);
  });

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    mainWindow?.webContents.send('shortcut-event', 'toggle-mic');
    overlayWindow?.webContents.send('shortcut-event', 'toggle-mic');
  });

  globalShortcut.register('CommandOrControl+Enter', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.webContents.send('shortcut-event', 'focus-ask');
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('get-backend-info', () => ({ port: backendPort, token: apiToken }));

  ipcMain.handle('toggle-overlay', (_event, show?: boolean) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return false;
    const shouldShow = typeof show === 'boolean' ? show : !overlayWindow.isVisible();
    if (shouldShow) {
      overlayWindow.show();
      overlayWindow.focus();
    } else {
      overlayWindow.hide();
    }
    return overlayWindow.isVisible();
  });

  ipcMain.handle('set-overlay-bounds', (_event, width: number, height: number) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setSize(Math.max(340, width), Math.max(140, height));
    }
  });

  ipcMain.handle('set-always-on-top', (_event, flag: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(flag);
      return overlayWindow.isAlwaysOnTop();
    }
    return false;
  });

  ipcMain.handle('get-privacy-status', () => getPrivacyStatus());
  ipcMain.handle('set-privacy-mode', (_event, enabled: boolean) => applyPrivacyMode(enabled));

  ipcMain.handle('get-stored-key-providers', async () => {
    const keys = await loadVaultKeys();
    return Object.keys(keys);
  });

  ipcMain.handle('set-provider-api-key', async (_event, provider: string, key: string) => {
    const keys = await loadVaultKeys();
    if (key.trim()) {
      keys[provider.toLowerCase()] = key.trim();
    } else {
      delete keys[provider.toLowerCase()];
    }
    await saveVaultKeys(keys);
    await syncKeysToBackend(keys);
    return Object.keys(keys);
  });

  ipcMain.handle('clear-all-api-keys', async () => {
    await saveVaultKeys({});
    await syncKeysToBackend({});
    return [];
  });

  ipcMain.handle('export-text-file', async (_event, defaultName: string, content: string, ext: 'md' | 'txt') => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Export ${ext.toUpperCase()}`,
      defaultPath: `${defaultName.replace(/[^a-z0-9\-_ ]/gi, '_')}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (canceled || !filePath) return null;
    await fsp.writeFile(filePath, content, 'utf8');
    return filePath;
  });

  ipcMain.handle('export-pdf-file', async (_event, title: string, markdownContent: string) => {
    return exportMarkdownAsPdf(title, markdownContent);
  });

  ipcMain.handle('focus-main-window', (_event, targetScreen?: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (targetScreen) {
        mainWindow.webContents.send('shortcut-event', `navigate:${targetScreen}`);
      }
    }
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  try {
    await startPythonBackend();
  } catch (err) {
    dialog.showErrorBox('OpenClue Backend Error', String(err));
  }
  createMainWindow();
  createOverlayWindow();
  registerShortcuts();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
