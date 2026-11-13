// Abstraction over Electron (preload bridge) and a plain browser (dev/tests).

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  promptPrice: number; // USD per token
  completionPrice: number;
  inputModalities: string[];
  created?: number;
}

export interface ChatBody {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: unknown }[];
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } | null;
  model?: string;
}

interface Bridge {
  isElectron: true;
  version(): Promise<string>;
  openExternal(url: string): Promise<void>;
  setReminders(cfg: unknown): Promise<unknown>;
  setLaunchAtLogin(on: boolean): Promise<boolean>;
  ai: {
    hasKey(): Promise<boolean>;
    setKey(key: string): Promise<unknown>;
    listModels(): Promise<ModelInfo[]>;
    keyInfo(): Promise<any>;
    abort(id: string): Promise<void>;
    chat(body: ChatBody, onDelta: (t: string) => void, onId?: (id: string) => void): Promise<ChatResult>;
  };
}

const bridge: Bridge | undefined = (window as any).saxBridge;
export const isElectron = Boolean(bridge?.isElectron);

const OR = 'https://openrouter.ai/api/v1';
const WEB_KEY = 'sax.webOpenRouterKey';
const webControllers = new Map<string, AbortController>();

/** In the browser build the key is kept in localStorage (development only). */
const webKey = () => localStorage.getItem(WEB_KEY) ?? '';

async function webChat(body: ChatBody, onDelta: (t: string) => void, onId?: (id: string) => void): Promise<ChatResult> {
  const id = `web-${Date.now()}`;
  onId?.(id);
  const ctrl = new AbortController();
  webControllers.set(id, ctrl);
  try {
    const res = await fetch(`${OR}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webKey()}` },
      body: JSON.stringify({ ...body, stream: true, usage: { include: true } }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      let msg = `Ошибка OpenRouter (${res.status})`;
      try {
        msg = (await res.json())?.error?.message || msg;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let text = '';
    let usage: ChatResult['usage'] = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const d = j.choices?.[0]?.delta?.content;
          if (d) {
            text += d;
            onDelta(d);
          }
          if (j.usage) usage = j.usage;
        } catch {
          /* partial line */
        }
      }
    }
    return { text, usage };
  } finally {
    webControllers.delete(id);
  }
}

export const platform = {
  isElectron,
  async version() {
    return bridge ? bridge.version() : 'web';
  },
  openExternal(url: string) {
    if (bridge) bridge.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  },
  setReminders(cfg: unknown) {
    return bridge?.setReminders(cfg);
  },
  setLaunchAtLogin(on: boolean) {
    return bridge?.setLaunchAtLogin(on);
  },
  ai: {
    hasKey: async () => (bridge ? bridge.ai.hasKey() : Boolean(webKey())),
    setKey: async (key: string) => {
      if (bridge) await bridge.ai.setKey(key);
      else localStorage.setItem(WEB_KEY, key.trim());
    },
    listModels: async (): Promise<ModelInfo[]> => {
      if (bridge) return bridge.ai.listModels();
      const res = await fetch(`${OR}/models`);
      const json = await res.json();
      return (json.data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        promptPrice: Number(m.pricing?.prompt ?? 0),
        completionPrice: Number(m.pricing?.completion ?? 0),
        inputModalities: m.architecture?.input_modalities || [],
        created: m.created,
      }));
    },
    keyInfo: async () => {
      if (bridge) return bridge.ai.keyInfo();
      const res = await fetch(`${OR}/key`, { headers: { Authorization: `Bearer ${webKey()}` } });
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      return (await res.json()).data;
    },
    abort: (id: string) => {
      if (bridge) bridge.ai.abort(id);
      else webControllers.get(id)?.abort();
    },
    chat: (body: ChatBody, onDelta: (t: string) => void, onId?: (id: string) => void) =>
      bridge ? bridge.ai.chat(body, onDelta, onId) : webChat(body, onDelta, onId),
  },
};
