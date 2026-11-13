// Main-thread audio engine: owns the AudioContext, the microphone chain
// (MediaStream → gain → AudioWorklet → analysis worker) and output buses.
import workletCode from './captureWorklet.js?raw';
import AnalysisWorker from './analysisWorker?worker&inline';
import type { Frame } from './dsp';

export type MicStatus = 'off' | 'starting' | 'on' | 'error';

type Listener<T> = (v: T) => void;

class Emitter<T> {
  private ls = new Set<Listener<T>>();
  on(l: Listener<T>) {
    this.ls.add(l);
    return () => {
      this.ls.delete(l);
    };
  }
  emit(v: T) {
    for (const l of this.ls) l(v);
  }
}

export interface Recording {
  pcm: Float32Array;
  sampleRate: number;
  start: number;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  clickBus!: GainNode;
  sfxBus!: GainNode;

  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private inputGain: GainNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private workletLoaded = false;
  private recResolve: ((r: Recording) => void) | null = null;

  status: MicStatus = 'off';
  error = '';
  deviceId = '';
  deviceLabel = '';
  lastFrame: Frame | null = null;
  /** Recent frames (about 12 s) for tuner history and debugging. */
  history: Frame[] = [];

  readonly frames = new Emitter<Frame>();
  readonly statusChanged = new Emitter<MicStatus>();

  private gateDb = -55;
  private a4 = 440;
  private gain = 1;

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.clickBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.clickBus.connect(this.master);
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* resumed later on a user gesture */
      }
    }
    return this.ctx;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Output + input latency estimate in seconds. */
  latency() {
    const ctx = this.ctx;
    const base = ctx?.baseLatency ?? 0.01;
    const output = (ctx as any)?.outputLatency ?? 0.02;
    let input = 0.01;
    const track = this.stream?.getAudioTracks()[0];
    const s: any = track?.getSettings?.();
    if (s && typeof s.latency === 'number') input = s.latency;
    return { base, output, input, total: base + output + input };
  }

  async listInputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput');
  }

  private setStatus(s: MicStatus, err = '') {
    this.status = s;
    this.error = err;
    this.statusChanged.emit(s);
  }

  async startMic(deviceId?: string): Promise<void> {
    const ctx = await this.ensureContext();
    if (this.status === 'on' && (deviceId === undefined || deviceId === this.deviceId)) return;
    this.stopMic();
    this.setStatus('starting');
    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      };
      if (deviceId) constraints.deviceId = { exact: deviceId };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      } catch (e: any) {
        if (deviceId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) {
          delete constraints.deviceId;
          stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        } else throw e;
      }
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      this.deviceId = track?.getSettings().deviceId ?? deviceId ?? '';
      this.deviceLabel = track?.label ?? '';
      track?.addEventListener('ended', () => this.setStatus('error', 'Микрофон отключён'));

      if (!this.workletLoaded) {
        const url = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        this.workletLoaded = true;
      }
      this.source = ctx.createMediaStreamSource(stream);
      this.inputGain = ctx.createGain();
      this.inputGain.gain.value = this.gain;
      this.capture = new AudioWorkletNode(ctx, 'sax-capture', { numberOfInputs: 1, numberOfOutputs: 0 });
      this.source.connect(this.inputGain);
      this.inputGain.connect(this.capture);

      this.worker = new AnalysisWorker();
      const ch = new MessageChannel();
      this.worker.postMessage({ type: 'init', sampleRate: ctx.sampleRate, a4: this.a4, gateDb: this.gateDb, port: ch.port2 }, [
        ch.port2,
      ]);
      this.capture.port.postMessage({ type: 'port', port: ch.port1 }, [ch.port1]);
      this.worker.onmessage = (e: MessageEvent) => {
        const d = e.data;
        if (d.type === 'frame') {
          const f: Frame = d.frame;
          this.lastFrame = f;
          this.history.push(f);
          if (this.history.length > 1200) this.history.splice(0, this.history.length - 1100);
          this.frames.emit(f);
        } else if (d.type === 'recording') {
          this.recResolve?.({ pcm: d.pcm, sampleRate: d.sampleRate, start: d.start });
          this.recResolve = null;
        }
      };
      this.setStatus('on');
    } catch (e: any) {
      const name = e?.name || '';
      let msg = 'Не удалось включить микрофон.';
      if (name === 'NotAllowedError' || name === 'SecurityError')
        msg = 'Доступ к микрофону запрещён. В Windows: Параметры → Конфиденциальность → Микрофон → разрешите доступ классическим приложениям.';
      else if (name === 'NotFoundError') msg = 'Микрофон не найден. Подключите микрофон и выберите его в настройках.';
      else if (name === 'NotReadableError') msg = 'Микрофон занят другой программой (Zoom, Discord и т.п.) или драйвер не отвечает.';
      this.setStatus('error', msg);
      throw new Error(msg);
    }
  }

  stopMic() {
    try {
      this.source?.disconnect();
      this.inputGain?.disconnect();
      this.capture?.disconnect();
    } catch {
      /* ignore */
    }
    this.worker?.terminate();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.inputGain = null;
    this.capture = null;
    this.worker = null;
    if (this.status !== 'off') this.setStatus('off');
  }

  setInputGain(g: number) {
    this.gain = g;
    if (this.inputGain) this.inputGain.gain.value = g;
  }

  setGate(db: number) {
    this.gateDb = db;
    this.worker?.postMessage({ type: 'config', gateDb: db });
  }

  setA4(a4: number) {
    this.a4 = a4;
    this.worker?.postMessage({ type: 'config', a4 });
  }

  getA4() {
    return this.a4;
  }

  onFrame(cb: (f: Frame) => void) {
    return this.frames.on(cb);
  }

  startRecording() {
    this.worker?.postMessage({ type: 'recStart' });
  }

  stopRecording(): Promise<Recording | null> {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000);
      this.recResolve = (r) => {
        clearTimeout(timer);
        resolve(r);
      };
      this.worker!.postMessage({ type: 'recStop' });
    });
  }

  /** Measures the room/background level for a few seconds and returns the median dB. */
  async measureNoise(seconds = 1.5): Promise<number> {
    const levels: number[] = [];
    const off = this.onFrame((f) => levels.push(f.db));
    await new Promise((r) => setTimeout(r, seconds * 1000));
    off();
    if (!levels.length) return -70;
    levels.sort((a, b) => a - b);
    return levels[Math.floor(levels.length / 2)];
  }
}

export const audio = new AudioEngine();

/** Encodes mono PCM as 16-bit WAV. */
export function pcmToWav(pcm: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Downsamples PCM (for compact storage / sending to AI). */
export function downsample(pcm: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return pcm;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(pcm.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const s = Math.floor(i * ratio);
    const e = Math.min(pcm.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let k = s; k < e; k++) sum += pcm[k];
    out[i] = sum / Math.max(1, e - s);
  }
  return out;
}
