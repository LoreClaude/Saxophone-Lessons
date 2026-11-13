// Pure DSP routines used by the analysis worker and by unit tests.
// No DOM / Web Audio dependencies here.

export interface Frame {
  /** Time of the analysis window centre in AudioContext seconds. */
  t: number;
  /** Fundamental frequency in Hz (0 if unvoiced). */
  f0: number;
  /** Concert MIDI pitch (fractional), NaN when unvoiced. */
  midi: number;
  /** RMS level in dBFS. */
  db: number;
  /** Periodicity 0..1 (1 - YIN aperiodicity). */
  clarity: number;
  /** Spectral flatness 0..1 (noise-like → 1). */
  flatness: number;
  /** Spectral centroid in Hz. */
  centroid: number;
  voiced: boolean;
}

export interface YinResult {
  f0: number;
  clarity: number;
}

/**
 * YIN pitch estimator (de Cheveigné & Kawahara 2002) with early termination
 * and a sub-octave check that protects against octave-up errors on
 * saxophone low notes, whose 2nd harmonic can be stronger than the fundamental.
 */
export function yin(
  buf: Float32Array,
  sampleRate: number,
  minF = 70,
  maxF = 1700,
  threshold = 0.12,
  scratch?: Float32Array,
): YinResult {
  const W = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxF));
  const tauMax = Math.min(W - 1, Math.ceil(sampleRate / minF));
  const d = scratch && scratch.length >= tauMax + 2 ? scratch : new Float32Array(tauMax + 2);
  d[0] = 1;
  let running = 0;
  let found = -1;
  let computedUpTo = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
    computedUpTo = tau;
    if (found < 0 && tau - 1 >= tauMin && d[tau - 1] < threshold && d[tau - 1] <= d[tau]) {
      found = tau - 1;
      // keep computing a little further for the sub-octave check (2·tau)
      if (2 * found + 2 > tauMax) break;
    }
    if (found >= 0 && tau >= 2 * found + 2) break;
  }

  let tau = found;
  if (tau < 0) {
    // no dip under the threshold: take the global minimum
    let best = 1e9;
    for (let t = tauMin; t <= computedUpTo; t++) {
      if (d[t] < best) {
        best = d[t];
        tau = t;
      }
    }
    if (tau < 0 || best > 0.45) return { f0: 0, clarity: Math.max(0, 1 - best) };
  } else {
    // sub-octave check: true period may be 2·tau if its dip is much deeper
    const t2 = tau * 2;
    if (t2 + 1 <= computedUpTo) {
      let m2 = t2;
      for (let t = t2 - 2; t <= t2 + 2; t++) if (t >= tauMin && t <= computedUpTo && d[t] < d[m2]) m2 = t;
      if (d[tau] > 0.04 && d[m2] < d[tau] * 0.5) tau = m2;
    }
  }

  // parabolic interpolation
  let better = tau;
  if (tau > 1 && tau < computedUpTo) {
    const s0 = d[tau - 1];
    const s1 = d[tau];
    const s2 = d[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  return { f0: sampleRate / better, clarity: Math.max(0, Math.min(1, 1 - d[tau])) };
}

export function rmsDb(buf: Float32Array, start = 0, end = buf.length): number {
  let s = 0;
  for (let i = start; i < end; i++) s += buf[i] * buf[i];
  const rms = Math.sqrt(s / Math.max(1, end - start));
  return rms > 1e-9 ? 20 * Math.log10(rms) : -180;
}

// ---------------------------------------------------------------------------
// FFT (in-place radix-2, real input via complex arrays)
// ---------------------------------------------------------------------------

export class FFT {
  readonly size: number;
  private cos: Float32Array;
  private sin: Float32Array;
  private rev: Uint32Array;
  readonly window: Float32Array;
  re: Float32Array;
  im: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.cos = new Float32Array(size / 2);
    this.sin = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
    this.rev = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.window = new Float32Array(size);
    for (let i = 0; i < size; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    this.re = new Float32Array(size);
    this.im = new Float32Array(size);
  }

  /** Power spectrum of a windowed real signal (length = size). */
  power(input: Float32Array, out: Float32Array) {
    const { size, re, im, rev, window } = this;
    for (let i = 0; i < size; i++) {
      re[rev[i]] = input[i] * window[i];
      im[rev[i]] = 0;
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len >> 1;
      const step = size / len;
      for (let i = 0; i < size; i += len) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const tre = re[i + j + half] * this.cos[k] - im[i + j + half] * this.sin[k];
          const tim = re[i + j + half] * this.sin[k] + im[i + j + half] * this.cos[k];
          re[i + j + half] = re[i + j] - tre;
          im[i + j + half] = im[i + j] - tim;
          re[i + j] += tre;
          im[i + j] += tim;
        }
      }
    }
    for (let i = 0; i < size / 2; i++) out[i] = re[i] * re[i] + im[i] * im[i];
  }
}

/** Spectral flatness and centroid between fLo and fHi. */
export function spectralShape(power: Float32Array, sampleRate: number, fftSize: number, fLo = 100, fHi = 8000) {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(fLo / binHz));
  const hi = Math.min(power.length - 1, Math.ceil(fHi / binHz));
  let logSum = 0;
  let sum = 0;
  let wsum = 0;
  let count = 0;
  for (let i = lo; i <= hi; i++) {
    const p = power[i] + 1e-12;
    logSum += Math.log(p);
    sum += p;
    wsum += p * i * binHz;
    count++;
  }
  const geo = Math.exp(logSum / count);
  const arith = sum / count;
  return { flatness: arith > 0 ? geo / arith : 0, centroid: sum > 0 ? wsum / sum : 0 };
}

// ---------------------------------------------------------------------------
// Frame analyzer
// ---------------------------------------------------------------------------

export interface AnalyzerOptions {
  sampleRate: number;
  windowSize?: number;
  a4?: number;
  gateDb?: number;
  minClarity?: number;
  minF?: number;
  maxF?: number;
}

export class FrameAnalyzer {
  readonly sampleRate: number;
  readonly windowSize: number;
  a4: number;
  gateDb: number;
  minClarity: number;
  minF: number;
  maxF: number;
  private scratch: Float32Array;
  private fft: FFT;
  private power: Float32Array;

  constructor(o: AnalyzerOptions) {
    this.sampleRate = o.sampleRate;
    this.windowSize = o.windowSize ?? (o.sampleRate > 60000 ? 4096 : 2048);
    this.a4 = o.a4 ?? 440;
    this.gateDb = o.gateDb ?? -55;
    this.minClarity = o.minClarity ?? 0.72;
    this.minF = o.minF ?? 70;
    this.maxF = o.maxF ?? 1700;
    this.scratch = new Float32Array(this.windowSize);
    this.fft = new FFT(this.windowSize);
    this.power = new Float32Array(this.windowSize / 2);
  }

  analyze(win: Float32Array, t: number): Frame {
    const db = rmsDb(win);
    let f0 = 0;
    let clarity = 0;
    if (db > this.gateDb - 6) {
      const r = yin(win, this.sampleRate, this.minF, this.maxF, 0.12, this.scratch);
      f0 = r.f0;
      clarity = r.clarity;
    }
    this.fft.power(win, this.power);
    const { flatness, centroid } = spectralShape(this.power, this.sampleRate, this.windowSize);
    const voiced = db > this.gateDb && clarity >= this.minClarity && f0 >= this.minF && f0 <= this.maxF;
    const midi = voiced ? 69 + 12 * Math.log2(f0 / this.a4) : NaN;
    return { t, f0: voiced ? f0 : 0, midi, db, clarity, flatness, centroid, voiced };
  }
}

/** Runs the analyzer over a whole buffer (offline), hop in samples. */
export function analyzeBuffer(
  samples: Float32Array,
  sampleRate: number,
  opts: Partial<AnalyzerOptions> = {},
  hop = 512,
  t0 = 0,
): Frame[] {
  const an = new FrameAnalyzer({ sampleRate, ...opts });
  const W = an.windowSize;
  const frames: Frame[] = [];
  for (let end = W; end <= samples.length; end += hop) {
    const win = samples.subarray(end - W, end);
    frames.push(an.analyze(win, t0 + (end - W / 2) / sampleRate));
  }
  return frames;
}
