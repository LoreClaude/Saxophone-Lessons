// Backing tracks ("минусовки"), metronome and reference-melody playback.
// Everything is scheduled on the AudioContext clock bar by bar with a small
// look-ahead, so tracks can loop forever and stop instantly.
import { audio } from './engine';
import { instruments } from './sampler';
import { click, hat, kick, ride, rim, snare } from './synth';
import { parseChord, type Chord } from '../music/theory';
import { ALTO_TRANSPOSE } from '../music/notes';
import type { Score } from '../music/abc';
import { swingBeat } from '../music/rhythm';

export type BackingStyle = 'swing' | 'blues' | 'bossa' | 'rock' | 'ballad' | 'funk' | 'waltz' | 'pop' | 'none';

export const STYLE_NAMES: Record<BackingStyle, string> = {
  swing: 'Свинг',
  blues: 'Блюз-шаффл',
  bossa: 'Босса-нова',
  rock: 'Рок',
  ballad: 'Баллада',
  funk: 'Фанк',
  waltz: 'Вальс',
  pop: 'Поп',
  none: 'Без аккомпанемента',
};

export interface SessionOptions {
  bpm: number;
  beatsPerBar: number;
  /** Count-in bars before beat 0. */
  countInBars?: number;
  /** Total length in beats (after the count-in); Infinity to loop. */
  totalBeats: number;
  metronome?: boolean;
  metronomeVolume?: number;
  metronomeSound?: 'click' | 'wood' | 'beep';
  /** Subdivision clicks per beat (1 = quarters, 2 = eighths, 3 = triplets). */
  subdivision?: number;
  accentFirst?: boolean;
  style?: BackingStyle;
  /** Chord chart in WRITTEN (saxophone) key, one array per bar. */
  chords?: string[][];
  backingVolume?: number;
  /** Reference melody to play with the sax sampler. */
  melody?: Score;
  melodyVolume?: number;
  /** Swing feel for the melody playback (eighths). */
  swingMelody?: boolean;
  /** Called on every beat (UI pulse). */
  onBeat?: (beat: number, time: number) => void;
}

export interface Session {
  /** Context time of beat 0 (after the count-in). */
  t0: number;
  bpm: number;
  beatToTime(beat: number): number;
  timeToBeat(time: number): number;
  stop(): void;
  readonly stopped: boolean;
}

const SECONDS_AHEAD = 1.2;

/** Starts metronome/backing/melody. Resolves when audio is scheduled. */
export async function startSession(o: SessionOptions): Promise<Session> {
  const ctx = await audio.ensureContext();
  const needSamples = (o.style && o.style !== 'none') || o.melody;
  if (needSamples) await Promise.all([instruments.piano.load(), instruments.bass.load(), instruments.sax.load()]);

  const spb = 60 / o.bpm;
  const countIn = (o.countInBars ?? 1) * o.beatsPerBar;
  const tStart = ctx.currentTime + 0.25;
  const t0 = tStart + countIn * spb;

  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(audio.musicBus);
  const clickBus = ctx.createGain();
  clickBus.connect(audio.clickBus);
  const backingGain = ctx.createGain();
  backingGain.gain.value = o.backingVolume ?? 0.8;
  backingGain.connect(bus);
  const melodyGain = ctx.createGain();
  melodyGain.gain.value = o.melodyVolume ?? 0.9;
  melodyGain.connect(bus);

  // validate the chart early (throws on a bad symbol) but keep the strings
  const chords: string[][] = (o.chords ?? []).map((bar) => bar.filter((s) => parseChord(s)));
  let nextBeat = -countIn; // next beat to schedule (relative to beat 0)
  let stopped = false;
  const voices: { stop: (t?: number) => void }[] = [];
  const timers: number[] = [];

  const melodyNotes = o.melody?.notes ?? [];
  let melodyIdx = 0;

  const scheduleBeat = (beat: number) => {
    const time = t0 + beat * spb;
    const inCountIn = beat < 0;
    const barBeat = ((beat % o.beatsPerBar) + o.beatsPerBar) % o.beatsPerBar;
    // metronome (always during count-in)
    if (o.metronome || inCountIn) {
      const sub = o.subdivision ?? 1;
      for (let s = 0; s < sub; s++) {
        click(
          time + (s * spb) / sub,
          s === 0 && barBeat === 0 && (o.accentFirst ?? true),
          (s === 0 ? 1 : 0.45) * (o.metronomeVolume ?? 0.8),
          o.metronomeSound ?? 'wood',
          clickBus,
        );
      }
    }
    if (o.onBeat) {
      const delay = Math.max(0, (time - ctx.currentTime) * 1000);
      timers.push(window.setTimeout(() => !stopped && o.onBeat!(beat, time), delay));
    }
    if (!inCountIn && o.style && o.style !== 'none' && chords.length) {
      const bar = Math.floor(beat / o.beatsPerBar);
      if (barBeat === 0) scheduleBar(bar, time);
    }
    // melody notes starting within this beat
    while (melodyIdx < melodyNotes.length && melodyNotes[melodyIdx].beat < beat + 1 - 1e-6) {
      const nt = melodyNotes[melodyIdx++];
      if (nt.beat < beat - 1e-6) continue;
      let start = nt.beat;
      if (o.swingMelody) start = swingBeat(start);
      const when = t0 + start * spb;
      let dur = nt.beats * spb;
      if (o.swingMelody) dur = (swingBeat(nt.beat + nt.beats) - start) * spb;
      if (nt.staccato) dur *= 0.45;
      else if (!melodyNotes[melodyIdx]?.slurred) dur *= 0.92;
      voices.push(
        instruments.sax.play(nt.midi + ALTO_TRANSPOSE, when, dur, {
          velocity: Math.min(1, (nt.volume || 90) / 110) * (nt.accent ? 1.1 : 1),
          out: melodyGain,
        }),
      );
    }
  };

  const scheduleBar = (bar: number, time: number) => {
    const chart = chords.length ? chords[bar % chords.length] : [];
    if (!chart.length) return;
    const bpb = o.beatsPerBar;
    const perChord = bpb / chart.length;
    const nextChart = chords[(bar + 1) % chords.length] ?? chart;
    playStyleBar(o.style!, {
      time,
      spb,
      bpb,
      chords: chart,
      perChord,
      next: nextChart[0],
      out: backingGain,
      voices,
      bar,
    });
  };

  const totalBeats = o.totalBeats;
  const pump = () => {
    if (stopped) return;
    const horizon = ctx.currentTime + SECONDS_AHEAD;
    while (!stopped && t0 + nextBeat * spb < horizon && nextBeat < totalBeats) {
      scheduleBeat(nextBeat);
      nextBeat++;
      if (totalBeats === Infinity && melodyNotes.length && melodyIdx >= melodyNotes.length) {
        /* melody does not loop */
      }
    }
  };
  pump();
  const interval = window.setInterval(pump, 100);

  const session: Session = {
    t0,
    bpm: o.bpm,
    beatToTime: (b) => t0 + b * spb,
    timeToBeat: (t) => (t - t0) / spb,
    get stopped() {
      return stopped;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(interval);
      timers.forEach((t) => window.clearTimeout(t));
      const now = ctx.currentTime;
      bus.gain.setTargetAtTime(0, now, 0.03);
      clickBus.gain.setTargetAtTime(0, now, 0.01);
      voices.forEach((v) => v.stop(now));
      setTimeout(() => {
        bus.disconnect();
        clickBus.disconnect();
      }, 600);
    },
  };
  return session;
}

export { swingBeat };

// ---------------------------------------------------------------------------
// Style patterns
// ---------------------------------------------------------------------------

interface BarCtx {
  time: number;
  spb: number;
  bpb: number;
  chords: string[];
  perChord: number;
  next: string;
  out: AudioNode;
  voices: { stop: (t?: number) => void }[];
  bar: number;
}

const concertRoot = (c: Chord) => (((c.rootPc + ALTO_TRANSPOSE) % 12) + 12) % 12;

/** Bass note for a pitch class in the comfortable E1..G3 range around C2. */
function bassNote(pc: number, around = 36) {
  let m = 24 + pc;
  while (m < around - 5) m += 12;
  return m;
}

/** Rootless-ish voicing in the C3..C5 range. */
function voicing(c: Chord, jazz: boolean): number[] {
  const root = concertRoot(c);
  const ints = c.intervals;
  let tones: number[];
  if (jazz && ints.length >= 4) {
    // 3, 7, 9 (or 5), root-less
    const third = ints[1];
    const seventh = ints[3];
    const ninth = ints[4] ?? 14;
    tones = [third, seventh, ninth, ints[2] + 12].map((i) => root + i);
  } else {
    tones = ints.slice(0, 4).map((i) => root + i);
  }
  return tones.map((m) => {
    let x = m + 48;
    while (x < 52) x += 12;
    while (x > 70) x -= 12;
    return x;
  });
}

function chordAt(b: BarCtx, beatInBar: number): Chord {
  const idx = Math.min(b.chords.length - 1, Math.floor(beatInBar / b.perChord));
  return parseChord(b.chords[idx]);
}

function pianoChord(b: BarCtx, beatInBar: number, dur: number, vel: number, jazz = true) {
  const c = chordAt(b, beatInBar);
  const t = b.time + beatInBar * b.spb;
  for (const m of voicing(c, jazz)) b.voices.push(instruments.piano.play(m, t, dur * b.spb, { velocity: vel, out: b.out }));
}

function bass(b: BarCtx, beatInBar: number, midi: number, dur: number, vel = 0.9) {
  const t = b.time + beatInBar * b.spb;
  b.voices.push(instruments.bass.play(midi, t, dur * b.spb * 0.95, { velocity: vel, out: b.out }));
}

function walkingLine(b: BarCtx): number[] {
  // 4 quarter notes per bar (or per beatsPerBar) leading to the next root
  const out: number[] = [];
  for (let k = 0; k < b.bpb; k++) {
    const c = chordAt(b, k);
    const root = bassNote(concertRoot(c));
    if (k === 0 || k % b.perChord === 0) out.push(root);
    else if (k === b.bpb - 1) {
      const nextRoot = bassNote(concertRoot(parseChord(b.next)));
      out.push(nextRoot + (Math.random() < 0.5 ? 1 : -1)); // chromatic approach
    } else {
      const tones = c.intervals.slice(1, 4).map((i) => root + i);
      out.push(tones[(k + b.bar) % tones.length]);
    }
  }
  return out;
}

function playStyleBar(style: BackingStyle, b: BarCtx) {
  const s = b.spb;
  const T = (beat: number) => b.time + beat * s;
  const sw = (beat: number) => T(swingBeat(beat));
  switch (style) {
    case 'swing': {
      for (let k = 0; k < b.bpb; k++) {
        ride(T(k), k % 2 === 0 ? 0.8 : 1, b.out);
        if (k % 2 === 1) ride(sw(k + 0.5), 0.6, b.out);
        if (k % 2 === 1) hat(T(k), 0.5, false, b.out);
        kick(T(k), 0.18, b.out);
      }
      walkingLine(b).forEach((m, k) => bass(b, k, m, 1));
      // Charleston: beat 1 and the "and" of 2
      pianoChord(b, 0, 0.9, 0.5);
      pianoChord(b, swingBeat(1.5), 0.6, 0.45);
      if (b.bar % 2 === 1) pianoChord(b, swingBeat(3.5), 0.5, 0.4);
      break;
    }
    case 'blues': {
      for (let k = 0; k < b.bpb; k++) {
        hat(T(k), 0.7, false, b.out);
        hat(sw(k + 0.5), 0.45, false, b.out);
        if (k % 2 === 0) kick(T(k), 0.7, b.out);
        else snare(T(k), 0.6, b.out);
      }
      // boogie bass: 1 3 5 6 b7 6 5 3 (swung eighths)
      const c = chordAt(b, 0);
      const r = bassNote(concertRoot(c));
      const pat = [0, 4, 7, 9, 10, 9, 7, 4];
      pat.forEach((iv, i) => bass(b, swingBeat(i * 0.5), r + iv, 0.45, 0.8));
      pianoChord(b, 1, 0.5, 0.45, false);
      pianoChord(b, 3, 0.5, 0.45, false);
      break;
    }
    case 'bossa': {
      for (let i = 0; i < b.bpb * 2; i++) hat(T(i * 0.5), i % 2 ? 0.35 : 0.5, false, b.out);
      // rim (2-bar clave feel)
      const rims = b.bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5];
      rims.forEach((x) => rim(T(x), 0.5, b.out));
      kick(T(0), 0.6, b.out);
      kick(T(1.5), 0.45, b.out);
      kick(T(2), 0.6, b.out);
      kick(T(3.5), 0.45, b.out);
      const c1 = chordAt(b, 0);
      const c2 = chordAt(b, 2);
      const r1 = bassNote(concertRoot(c1));
      const r2 = bassNote(concertRoot(c2));
      bass(b, 0, r1, 1.5);
      bass(b, 1.5, r1 + 7, 0.5);
      bass(b, 2, r2, 1.5);
      bass(b, 3.5, r2 + 7, 0.5);
      pianoChord(b, 0, 1, 0.4);
      pianoChord(b, 1.5, 0.9, 0.35);
      pianoChord(b, 3, 0.9, 0.35);
      break;
    }
    case 'rock':
    case 'pop': {
      for (let i = 0; i < b.bpb * 2; i++) hat(T(i * 0.5), i % 2 ? 0.4 : 0.6, false, b.out);
      kick(T(0), 0.9, b.out);
      kick(T(2), 0.8, b.out);
      if (style === 'rock') kick(T(2.5), 0.6, b.out);
      snare(T(1), 0.8, b.out);
      snare(T(3), 0.8, b.out);
      for (let i = 0; i < b.bpb * 2; i++) {
        const c = chordAt(b, i * 0.5);
        bass(b, i * 0.5, bassNote(concertRoot(c)), 0.45, i % 2 ? 0.7 : 0.9);
      }
      if (style === 'pop') {
        pianoChord(b, 0, 1.8, 0.4, false);
        pianoChord(b, 2, 1.8, 0.4, false);
      } else {
        for (let i = 0; i < b.bpb; i++) pianoChord(b, i + 0.5, 0.4, 0.35, false);
      }
      break;
    }
    case 'ballad': {
      for (let k = 0; k < b.bpb; k++) {
        snare(T(k), 0.5, b.out, true);
        if (k === 0) kick(T(0), 0.5, b.out);
      }
      rim(T(3), 0.25, b.out);
      const c1 = chordAt(b, 0);
      const c2 = chordAt(b, 2);
      bass(b, 0, bassNote(concertRoot(c1)), 2);
      bass(b, 2, bassNote(concertRoot(c2)) + (c2 === c1 ? 7 : 0), 2);
      // arpeggio eighths
      for (let i = 0; i < b.bpb * 2; i++) {
        const c = chordAt(b, i * 0.5);
        const v = voicing(c, true);
        const m = v[i % v.length];
        b.voices.push(instruments.piano.play(m, T(i * 0.5), s * 1.2, { velocity: 0.35, out: b.out }));
      }
      break;
    }
    case 'funk': {
      for (let i = 0; i < b.bpb * 4; i++) hat(T(i * 0.25), i % 2 ? 0.25 : 0.45, i === 14, b.out);
      kick(T(0), 0.9, b.out);
      kick(T(0.75), 0.6, b.out);
      kick(T(2.5), 0.8, b.out);
      snare(T(1), 0.85, b.out);
      snare(T(3), 0.85, b.out);
      snare(T(1.75), 0.2, b.out);
      snare(T(3.25), 0.2, b.out);
      const c = chordAt(b, 0);
      const r = bassNote(concertRoot(c));
      const pat: [number, number][] = [
        [0, 0],
        [0.75, 12],
        [1.5, 0],
        [2, 10],
        [2.5, 0],
        [3.25, 7],
        [3.5, 12],
      ];
      pat.forEach(([x, iv]) => bass(b, x, r + iv, 0.3, 0.85));
      [0.5, 1.75, 2.5, 3.5].forEach((x) => pianoChord(b, x, 0.2, 0.35));
      break;
    }
    case 'waltz': {
      kick(T(0), 0.6, b.out);
      ride(T(1), 0.4, b.out);
      ride(T(2), 0.4, b.out);
      const c = chordAt(b, 0);
      bass(b, 0, bassNote(concertRoot(c)), 1);
      pianoChord(b, 1, 0.8, 0.35, false);
      pianoChord(b, 2, 0.8, 0.35, false);
      break;
    }
    default:
      break;
  }
}

/** Plays a score once with the sax sampler (no metronome), returns the session. */
export function playMelody(score: Score, bpm = score.bpm, opts: Partial<SessionOptions> = {}) {
  return startSession({
    bpm,
    beatsPerBar: score.beatsPerBar,
    countInBars: 0,
    totalBeats: score.totalBeats,
    metronome: false,
    melody: score,
    ...opts,
  });
}

/** Plays a single sax note (written pitch) – for fingering chart / demos. */
export async function playSaxNote(written: number, seconds = 1.2, opts: { vibrato?: boolean; detune?: number; scoop?: number } = {}) {
  await audio.ensureContext();
  await instruments.sax.load();
  const t = audio.now() + 0.03;
  return instruments.sax.play(written + ALTO_TRANSPOSE, t, seconds, {
    velocity: 0.8,
    detuneCents: opts.detune,
    vibrato: opts.vibrato ? { rate: 5.5, cents: 22 } : undefined,
    scoop: opts.scoop,
  });
}
