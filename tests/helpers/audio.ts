import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const SR = 48000;

export function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Decodes any audio file to mono Float32 PCM at the given sample rate. */
export function decode(file: string, sampleRate = SR): Float32Array {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(sampleRate), '-'], {
    maxBuffer: 1 << 28,
  });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

export const SAMPLE_DIR = path.resolve(__dirname, '../../public/samples/sax');

export function sampleFiles() {
  return fs
    .readdirSync(SAMPLE_DIR)
    .filter((f) => f.endsWith('.mp3'))
    .map((f) => ({ file: path.join(SAMPLE_DIR, f), midi: sampleMidi(f) }));
}

/** "Cs4.mp3" → 61 (concert pitch). */
export function sampleMidi(name: string) {
  const m = /^([A-G])(s?)(\d)\.mp3$/.exec(name)!;
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (Number(m[3]) + 1) * 12 + base[m[1]] + (m[2] ? 1 : 0);
}

/** Saxophone-like harmonic tone. */
export function saxTone(freq: number, seconds: number, sr = SR, amp = 0.3, opts: { noise?: number; vibrato?: { rate: number; cents: number } } = {}) {
  const n = Math.floor(seconds * sr);
  const out = new Float32Array(n);
  const harm = [1, 0.9, 0.65, 0.5, 0.42, 0.3, 0.22, 0.16, 0.12, 0.08];
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const vib = opts.vibrato ? Math.pow(2, (opts.vibrato.cents / 1200) * Math.sin(2 * Math.PI * opts.vibrato.rate * t)) : 1;
    phase += (2 * Math.PI * freq * vib) / sr;
    let s = 0;
    for (let h = 0; h < harm.length; h++) {
      if (freq * (h + 1) > sr / 2.2) break;
      s += harm[h] * Math.sin(phase * (h + 1));
    }
    const env = Math.min(1, t / 0.03) * Math.min(1, (seconds - t) / 0.03);
    out[i] = amp * env * (s / 3) + (opts.noise ?? 0.002) * (Math.random() * 2 - 1);
  }
  return out;
}

export function silence(seconds: number, sr = SR) {
  const out = new Float32Array(Math.floor(seconds * sr));
  for (let i = 0; i < out.length; i++) out[i] = 0.0005 * (Math.random() * 2 - 1);
  return out;
}

export function concat(parts: Float32Array[]) {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Joins tones without gaps (legato) with continuous phase. */
export function legato(freqs: number[], each: number, sr = SR, amp = 0.3) {
  const n = Math.floor(each * sr);
  const out = new Float32Array(n * freqs.length);
  const harm = [1, 0.9, 0.65, 0.5, 0.42, 0.3, 0.22, 0.16];
  let phase = 0;
  for (let k = 0; k < freqs.length; k++) {
    for (let i = 0; i < n; i++) {
      phase += (2 * Math.PI * freqs[k]) / sr;
      let s = 0;
      for (let h = 0; h < harm.length; h++) s += harm[h] * Math.sin(phase * (h + 1));
      const gi = k * n + i;
      const t = gi / sr;
      const total = freqs.length * each;
      const env = Math.min(1, t / 0.03) * Math.min(1, (total - t) / 0.03);
      out[gi] = amp * env * (s / 3);
    }
  }
  return out;
}

export function writeWav(file: string, samples: Float32Array, sr = SR) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}
