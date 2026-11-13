// Sample-based instruments (real alto saxophone, piano, electric bass).
import { audio } from './engine';

export type InstrumentId = 'sax' | 'piano' | 'bass';

const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
const fileFor = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}.mp3`;

const SETS: Record<InstrumentId, { dir: string; notes: number[] }> = {
  // concert pitches of the available samples
  sax: {
    dir: 'samples/sax',
    notes: [49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81],
  },
  piano: { dir: 'samples/piano', notes: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84] },
  bass: { dir: 'samples/bass', notes: [28, 31, 34, 37, 40, 43, 46, 49, 52, 55] },
};

export interface PlayOptions {
  velocity?: number; // 0..1
  detuneCents?: number;
  vibrato?: { rate: number; cents: number; delay?: number };
  attack?: number;
  release?: number;
  /** Pitch bend down then back (cents) – for jazz "scoop"/bend demos. */
  scoop?: number;
  out?: AudioNode;
}

export interface Voice {
  stop(at?: number): void;
}

class Sampler {
  readonly id: InstrumentId;
  private buffers = new Map<number, AudioBuffer>();
  private loops = new Map<number, [number, number]>();
  private loading: Promise<void> | null = null;

  constructor(id: InstrumentId) {
    this.id = id;
  }

  get loaded() {
    return this.buffers.size > 0;
  }

  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const ctx = await audio.ensureContext();
      const set = SETS[this.id];
      await Promise.all(
        set.notes.map(async (m) => {
          try {
            const res = await fetch(`./${set.dir}/${fileFor(m)}`);
            const arr = await res.arrayBuffer();
            const buf = await ctx.decodeAudioData(arr);
            this.buffers.set(m, buf);
            if (this.id === 'sax') this.loops.set(m, findLoop(buf));
          } catch (e) {
            console.warn('sample load failed', this.id, m, e);
          }
        }),
      );
    })();
    return this.loading;
  }

  private nearest(m: number): [number, AudioBuffer] | null {
    let best: number | null = null;
    for (const k of this.buffers.keys()) if (best === null || Math.abs(k - m) < Math.abs(best - m)) best = k;
    return best === null ? null : [best, this.buffers.get(best)!];
  }

  /** Plays a concert-pitch MIDI note at `when` for `dur` seconds. */
  play(midi: number, when: number, dur: number, o: PlayOptions = {}): Voice {
    const ctx = audio.ctx!;
    const near = this.nearest(midi);
    if (!near) return { stop() {} };
    const [base, buf] = near;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (midi - base) / 12);
    src.detune.value = o.detuneCents ?? 0;
    const g = ctx.createGain();
    const vel = o.velocity ?? 0.8;
    const peak = this.id === 'sax' ? vel * 0.9 : this.id === 'bass' ? vel * 1.0 : vel * 0.55;
    const attack = o.attack ?? (this.id === 'sax' ? 0.025 : 0.004);
    const release = o.release ?? (this.id === 'sax' ? 0.09 : this.id === 'piano' ? 0.35 : 0.12);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.setValueAtTime(peak, when + Math.max(attack, dur));
    g.gain.linearRampToValueAtTime(0, when + Math.max(attack, dur) + release);
    if (this.id === 'sax') {
      const loop = this.loops.get(base);
      const needed = (dur + release) * src.playbackRate.value;
      if (loop && needed > buf.duration - 0.2) {
        src.loop = true;
        src.loopStart = loop[0];
        src.loopEnd = loop[1];
      }
    }
    let lfo: OscillatorNode | null = null;
    if (o.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibrato.rate;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, when);
      depth.gain.linearRampToValueAtTime(0, when + (o.vibrato.delay ?? 0.15));
      depth.gain.linearRampToValueAtTime(o.vibrato.cents, when + (o.vibrato.delay ?? 0.15) + 0.3);
      lfo.connect(depth);
      depth.connect(src.detune);
      lfo.start(when);
      lfo.stop(when + dur + release + 0.1);
    }
    if (o.scoop) {
      src.detune.setValueAtTime((o.detuneCents ?? 0) - o.scoop, when);
      src.detune.linearRampToValueAtTime(o.detuneCents ?? 0, when + Math.min(0.25, dur * 0.5));
    }
    src.connect(g);
    g.connect(o.out ?? audio.musicBus);
    src.start(when);
    src.stop(when + dur + release + 0.05);
    return {
      stop(at?: number) {
        const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setTargetAtTime(0, t, 0.02);
          src.stop(t + 0.15);
          lfo?.stop(t + 0.15);
        } catch {
          /* already stopped */
        }
      },
    };
  }
}

/** Finds zero-crossing loop points in the sustained part of a sample. */
function findLoop(buf: AudioBuffer): [number, number] {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const zc = (from: number) => {
    for (let i = Math.floor(from * sr); i < data.length - 1; i++) if (data[i] <= 0 && data[i + 1] > 0) return i / sr;
    return from;
  };
  const start = zc(Math.min(1.0, buf.duration * 0.25));
  const end = zc(Math.max(start + 0.5, buf.duration - 0.8));
  return [start, end];
}

export const instruments: Record<InstrumentId, Sampler> = {
  sax: new Sampler('sax'),
  piano: new Sampler('piano'),
  bass: new Sampler('bass'),
};

export async function loadAllInstruments() {
  await Promise.all(Object.values(instruments).map((s) => s.load()));
}
