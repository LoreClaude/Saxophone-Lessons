// Preload: exposes a narrow, typed bridge to the renderer.
import { contextBridge, ipcRenderer } from 'electron';

let counter = 0;

const bridge = {
  isElectron: true as const,
  version: () => ipcRenderer.invoke('app:version') as Promise<string>,
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  setReminders: (cfg: unknown) => ipcRenderer.invoke('app:setReminders', cfg),
  setLaunchAtLogin: (on: boolean) => ipcRenderer.invoke('app:setLaunchAtLogin', on) as Promise<boolean>,
  ai: {
    hasKey: () => ipcRenderer.invoke('ai:hasKey') as Promise<boolean>,
    setKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
    listModels: () => ipcRenderer.invoke('ai:listModels'),
    keyInfo: () => ipcRenderer.invoke('ai:keyInfo'),
    abort: (id: string) => ipcRenderer.invoke('ai:abort', id),
    chat: async (body: unknown, onDelta: (text: string) => void, onId?: (id: string) => void) => {
      const id = `req-${Date.now()}-${++counter}`;
      onId?.(id);
      const listener = (_e: unknown, reqId: string, delta: string) => {
        if (reqId === id) onDelta(delta);
      };
      ipcRenderer.on('ai:delta', listener);
      try {
        return await ipcRenderer.invoke('ai:chat', id, body);
      } finally {
        ipcRenderer.removeListener('ai:delta', listener);
      }
    },
  },
};

contextBridge.exposeInMainWorld('saxBridge', bridge);

export type SaxBridge = typeof bridge;
