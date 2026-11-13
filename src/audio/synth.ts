// Synthesized sounds: metronome click, drums, drone and game sound effects.
import { audio } from './engine';

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function env(g: GainNode, when: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
}

// ---------------------------------------------------------------------------
// Metronome
// ---------------------------------------------------------------------------

export function click(when: number, accent = false, volume = 1, sound: 'click' | 'wood' | 'beep' = 'wood', out?: AudioNode) {
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const dest = out ?? audio.clickBus;
  if (sound === 'beep') {
    o.type = 'sine';
    o.frequency.value = accent ? 1760 : 1320;
    env(g, when, 0.5 * volume, 0.002, 0.06);
  } else if (sound === 'click') {
    o.type = 'square';
    o.frequency.value = accent ? 2400 : 1800;
    env(g, when, 0.25 * volume, 0.001, 0.025);
  } else {
    o.type = 'triangle';
    o.frequency.value = accent ? 1250 : 880;
    env(g, when, 0.7 * volume, 0.001, 0.05);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = accent ? 3200 : 2500;
    bp.Q.value = 4;
    const ng = ctx.createGain();
    env(ng, when, 0.35 * volume, 0.001, 0.02);
    n.connect(bp).connect(ng).connect(dest);
    n.start(when);
    n.stop(when + 0.05);
  }
  o.connect(g).connect(dest);
  o.start(when);
  o.stop(when + 0.1);
}

// ---------------------------------------------------------------------------
// Drums
// ---------------------------------------------------------------------------

export function kick(when: number, vel = 1, out?: AudioNode) {
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, when);
  o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  env(g, when, 0.9 * vel, 0.002, 0.28);
  o.connect(g).connect(out ?? audio.musicBus);
  o.start(when);
  o.stop(when + 0.35);
}

export function snare(when: number, vel = 1, out?: AudioNode, brush = false) {
  const ctx = audio.ctx!;
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = brush ? 'bandpass' : 'highpass';
  f.frequency.value = brush ? 3500 : 1500;
  const g = ctx.createGain();
  env(g, when, (brush ? 0.25 : 0.55) * vel, brush ? 0.01 : 0.001, brush ? 0.18 : 0.15);
  n.connect(f).connect(g).connect(out ?? audio.musicBus);
  n.start(when, Math.random());
  n.stop(when + 0.3);
  if (!brush) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, when);
    o.frequency.exponentialRampToValueAtTime(150, when + 0.08);
    const og = ctx.createGain();
    env(og, when, 0.35 * vel, 0.001, 0.09);
    o.connect(og).connect(out ?? audio.musicBus);
    o.start(when);
    o.stop(when + 0.15);
  }
}

export function hat(when: number, vel = 1, open = false, out?: AudioNode) {
  const ctx = audio.ctx!;
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  env(g, when, 0.22 * vel, 0.001, open ? 0.3 : 0.045);
  n.connect(f).connect(g).connect(out ?? audio.musicBus);
  n.start(when, Math.random());
  n.stop(when + (open ? 0.4 : 0.08));
}

export function ride(when: number, vel = 1, out?: AudioNode) {
  const ctx = audio.ctx!;
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 6500;
  f.Q.value = 1.2;
  const g = ctx.createGain();
  env(g, when, 0.2 * vel, 0.001, 0.45);
  n.connect(f).connect(g).connect(out ?? audio.musicBus);
  n.start(when, Math.random());
  n.stop(when + 0.5);
  // metallic ping
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 5200;
  const og = ctx.createGain();
  env(og, when, 0.02 * vel, 0.001, 0.3);
  o.connect(og).connect(out ?? audio.musicBus);
  o.start(when);
  o.stop(when + 0.35);
}

export function rim(when: number, vel = 1, out?: AudioNode) {
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 1700;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1700;
  f.Q.value = 6;
  const g = ctx.createGain();
  env(g, when, 0.5 * vel, 0.001, 0.035);
  o.connect(f).connect(g).connect(out ?? audio.musicBus);
  o.start(when);
  o.stop(when + 0.06);
}

// ---------------------------------------------------------------------------
// Drone (sustained reference tone)
// ---------------------------------------------------------------------------

export function startDrone(concertMidi: number, volume = 0.35, type: 'organ' | 'soft' | 'fifth' = 'organ', a4 = 440) {
  const ctx = audio.ctx!;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = type === 'soft' ? 900 : 2200;
  lp.connect(out).connect(audio.musicBus);
  const f = a4 * Math.pow(2, (concertMidi - 69) / 12);
  const parts: [number, OscillatorType, number][] =
    type === 'soft'
      ? [
          [1, 'sine', 0.6],
          [2, 'sine', 0.15],
        ]
      : [
          [1, 'sawtooth', 0.25],
          [0.5, 'sine', 0.35],
          [2, 'sine', 0.1],
        ];
  if (type === 'fifth') parts.push([1.5, 'sawtooth', 0.12]);
  const oscs = parts.map(([mul, t, g]) => {
    const o = ctx.createOscillator();
    o.type = t;
    o.frequency.value = f * mul;
    const gg = ctx.createGain();
    gg.gain.value = g;
    o.connect(gg).connect(lp);
    o.start();
    return o;
  });
  return {
    setNote(m: number) {
      const nf = a4 * Math.pow(2, (m - 69) / 12);
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(nf * parts[i][0], ctx.currentTime, 0.05));
    },
    setVolume(v: number) {
      out.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    stop() {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.1);
      oscs.forEach((o) => o.stop(t + 0.6));
    },
  };
}

// ---------------------------------------------------------------------------
// Game sound effects
// ---------------------------------------------------------------------------

function tone(freq: number, when: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const ctx = audio.ctx!;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  env(g, when, vol, 0.005, dur);
  o.connect(g).connect(audio.sfxBus);
  o.start(when);
  o.stop(when + dur + 0.05);
}

export type Sfx = 'hit' | 'perfect' | 'miss' | 'success' | 'fail' | 'levelup' | 'achievement' | 'coin' | 'combo' | 'tap';

export function sfx(kind: Sfx) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  switch (kind) {
    case 'tap':
      tone(880, t, 0.05, 0.08, 'triangle');
      break;
    case 'hit':
      tone(1320, t, 0.08, 0.06, 'triangle');
      break;
    case 'perfect':
      tone(1568, t, 0.08, 0.07, 'triangle');
      tone(2093, t + 0.05, 0.12, 0.06, 'triangle');
      break;
    case 'miss':
      tone(196, t, 0.12, 0.08, 'sawtooth');
      break;
    case 'coin':
      tone(988, t, 0.06, 0.1, 'square');
      tone(1319, t + 0.06, 0.18, 0.1, 'square');
      break;
    case 'combo':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.05, 0.1, 0.07, 'triangle'));
      break;
    case 'success':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 0.12, 'triangle'));
      break;
    case 'fail':
      [392, 370, 349].forEach((f, i) => tone(f, t + i * 0.16, 0.25, 0.1, 'triangle'));
      break;
    case 'levelup':
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.3, 0.12, 'square'));
      break;
    case 'achievement':
      [880, 1109, 1319, 1760].forEach((f, i) => tone(f, t + i * 0.07, 0.35, 0.1, 'triangle'));
      break;
  }
}
