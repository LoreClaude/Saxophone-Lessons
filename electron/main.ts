// Electron main process for «Саксофония».
// Serves the built renderer from a custom secure protocol, grants microphone
// access, stores the OpenRouter key encrypted and proxies AI requests.
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  net,
  Notification,
  protocol,
  safeStorage,
  session,
  shell,
  Tray,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const APP_SCHEME = 'app';
const OPENROUTER = 'https://openrouter.ai/api/v1';

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const distDir = path.join(__dirname, '..', 'dist');
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let minimizeToTray = false;
let quitting = false;

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#120b2e',
    title: 'Саксофония',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(distDir, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${APP_SCHEME}://`) && !url.startsWith('http://localhost')) {
      e.preventDefault();
      if (/^https:\/\//.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('close', (e) => {
    if (minimizeToTray && !quitting) {
      e.preventDefault();
      mainWindow?.hide();
      ensureTray();
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadURL(`${APP_SCHEME}://bundle/index.html`);
}

function ensureTray() {
  if (tray) return;
  const iconPath = path.join(distDir, 'icon.png');
  const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
  tray = new Tray(img);
  tray.setToolTip('Саксофония');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть', click: () => showWindow() },
      { type: 'separator' },
      {
        label: 'Выход',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => showWindow());
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

// ---------------------------------------------------------------------------
// Encrypted key storage
// ---------------------------------------------------------------------------

const keyFile = () => path.join(app.getPath('userData'), 'openrouter.key');

function saveKey(key: string) {
  const file = keyFile();
  if (!key) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return;
  }
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(file, Buffer.concat([Buffer.from('ENC1'), safeStorage.encryptString(key)]));
  } else {
    fs.writeFileSync(file, Buffer.from('RAW1' + key, 'utf8'));
  }
}

function loadKey(): string {
  try {
    const buf = fs.readFileSync(keyFile());
    const tag = buf.subarray(0, 4).toString('utf8');
    if (tag === 'ENC1') return safeStorage.decryptString(buf.subarray(4));
    if (tag === 'RAW1') return buf.subarray(4).toString('utf8');
  } catch {
    /* no key */
  }
  return '';
}

// ---------------------------------------------------------------------------
// OpenRouter
// ---------------------------------------------------------------------------

const controllers = new Map<string, AbortController>();

function humanError(status: number, message: string): string {
  if (status === 401) return 'Ключ OpenRouter не подходит. Проверьте его в настройках.';
  if (status === 402) return 'На счёте OpenRouter закончились средства. Пополните баланс или выберите бесплатную модель.';
  if (status === 403) return 'OpenRouter отклонил запрос (модерация или ограничения модели).';
  if (status === 404) return 'Модель не найдена. Выберите другую модель в настройках.';
  if (status === 408) return 'Модель отвечала слишком долго. Попробуйте ещё раз.';
  if (status === 429) return 'Слишком много запросов (лимит бесплатных моделей). Подождите немного или выберите платную модель.';
  if (status >= 500) return 'Сервис модели временно недоступен. Попробуйте позже или выберите другую модель.';
  return message || `Ошибка OpenRouter (${status})`;
}

async function orFetch(pathname: string, init: RequestInit = {}) {
  const key = loadKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (key) headers.Authorization = `Bearer ${key}`;
  return net.fetch(`${OPENROUTER}${pathname}`, { ...init, headers });
}

ipcMain.handle('ai:hasKey', () => Boolean(loadKey()));
ipcMain.handle('ai:setKey', (_e, key: string) => {
  saveKey(String(key || '').trim());
  return true;
});

ipcMain.handle('ai:listModels', async () => {
  const res = await orFetch('/models');
  if (!res.ok) throw new Error(humanError(res.status, ''));
  const json: any = await res.json();
  return (json.data || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    contextLength: m.context_length,
    promptPrice: Number(m.pricing?.prompt ?? 0),
    completionPrice: Number(m.pricing?.completion ?? 0),
    inputModalities: m.architecture?.input_modalities || [],
    created: m.created,
  }));
});

ipcMain.handle('ai:keyInfo', async () => {
  const res = await orFetch('/key');
  if (!res.ok) throw new Error(humanError(res.status, ''));
  const json: any = await res.json();
  return json.data ?? json;
});

ipcMain.handle('ai:abort', (_e, id: string) => {
  controllers.get(id)?.abort();
  controllers.delete(id);
});

ipcMain.handle('ai:chat', async (event, id: string, body: any) => {
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  try {
    const res = await orFetch('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...body, stream: true, usage: { include: true } }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      let msg = '';
      try {
        const j: any = await res.json();
        msg = j?.error?.message || '';
      } catch {
        /* ignore */
      }
      throw new Error(humanError(res.status, msg));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    let usage: any = null;
    let model = body.model;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const chunk = JSON.parse(data);
          if (chunk.error) throw new Error(chunk.error.message || 'Ошибка модели');
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            if (!event.sender.isDestroyed()) event.sender.send('ai:delta', id, delta);
          }
          if (chunk.usage) usage = chunk.usage;
          if (chunk.model) model = chunk.model;
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
    return { text, usage, model };
  } finally {
    controllers.delete(id);
  }
});

// ---------------------------------------------------------------------------
// App helpers: reminders, autostart, external links
// ---------------------------------------------------------------------------

interface ReminderCfg {
  enabled: boolean;
  time: string; // HH:MM
  days: number[]; // 0..6, Sunday = 0
  minimizeToTray: boolean;
}
let reminder: ReminderCfg = { enabled: false, time: '19:00', days: [1, 2, 3, 4, 5, 6, 0], minimizeToTray: false };
let lastReminderKey = '';

setInterval(() => {
  if (!reminder.enabled) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const key = `${now.toDateString()} ${hhmm}`;
  if (hhmm === reminder.time && reminder.days.includes(now.getDay()) && key !== lastReminderKey) {
    lastReminderKey = key;
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Саксофония', body: 'Время позаниматься! Бибоп ждёт вас на репетиции 🎷' });
      n.on('click', () => showWindow());
      n.show();
    }
  }
}, 20_000);

ipcMain.handle('app:setReminders', (_e, cfg: ReminderCfg) => {
  reminder = { ...reminder, ...cfg };
  minimizeToTray = Boolean(cfg.minimizeToTray);
  if (minimizeToTray) ensureTray();
  return true;
});

ipcMain.handle('app:setLaunchAtLogin', (_e, on: boolean) => {
  app.setLoginItemSettings({ openAtLogin: Boolean(on), args: ['--hidden'] });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('app:openExternal', (_e, url: string) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.handle('app:version', () => app.getVersion());

// ---------------------------------------------------------------------------
// CI smoke test: load the packaged UI, check it rendered, write a report, exit
// ---------------------------------------------------------------------------

function runSmokeTest(reportFile: string) {
  const errors: string[] = [];
  const wc = mainWindow!.webContents;
  wc.on('console-message', (details: any) => {
    const level = details?.level ?? '';
    const message = String(details?.message ?? '');
    if ((level === 'error' || level === 3) && !/Failed to load resource/.test(message)) errors.push(message);
  });
  wc.on('render-process-gone', (_e, d) => errors.push(`renderer gone: ${d.reason}`));
  const finish = async () => {
    let text = '';
    let samples = false;
    try {
      text = await wc.executeJavaScript('document.getElementById("root")?.innerText || ""');
      samples = await wc.executeJavaScript('fetch("./samples/sax/A4.mp3").then(r => r.ok && r.headers.get("content-length") !== "0").catch(() => false)');
    } catch (e) {
      errors.push(String(e));
    }
    const ok = text.includes('Бибоп') && samples && errors.length === 0;
    fs.writeFileSync(reportFile, JSON.stringify({ ok, rendered: text.slice(0, 200), samples, errors }, null, 2));
    app.exit(ok ? 0 : 1);
  };
  wc.once('did-finish-load', () => setTimeout(finish, 4000));
  setTimeout(() => {
    fs.writeFileSync(reportFile, JSON.stringify({ ok: false, errors: ['timeout', ...errors] }));
    app.exit(2);
  }, 45_000);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, async (request) => {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      const filePath = path.normalize(path.join(distDir, pathname));
      if (!filePath.startsWith(distDir)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(filePath).toString());
    });

    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media' || permission === 'notifications' || permission === 'clipboard-sanitized-write');
    });
    ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'notifications');

    createWindow();
    if (process.argv.includes('--hidden')) {
      mainWindow?.once('ready-to-show', () => mainWindow?.hide());
      ensureTray();
    }
    const smokeArg = process.argv.find((a) => a.startsWith('--smoke-test='));
    if (smokeArg) runSmokeTest(smokeArg.split('=')[1]);
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
