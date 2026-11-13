import { describe, expect, it } from 'vitest';
import { analyzeBuffer } from '../src/audio/dsp';
import { parseScore, notesToAbc, type Score } from '../src/music/abc';
import { midiToFreq } from '../src/music/notes';
import {
  evaluateSequence,
  evaluateLongTone,
  evaluateVibrato,
  evaluateDynamics,
  evaluateMouthpiece,
  evaluateBreath,
  evaluateImprov,
  evaluateWait,
  alignSequence,
  arcade,
} from '../src/practice/evaluate';
import { tolerances } from '../src/practice/types';
import { saxTone, SR } from './helpers/audio';

const tol = tolerances(2);

function render(score: Score, bpm: number, t0: number, o: { offset?: number; cents?: number; wrong?: Record<number, number>; total?: number } = {}) {
  const spb = 60 / bpm;
  const total = o.total ?? t0 + score.totalBeats * spb + 1;
  const out = new Float32Array(Math.floor(total * SR));
  for (let i = 0; i < out.length; i++) out[i] = 0.0005 * (Math.random() * 2 - 1);
  for (const nt of score.notes) {
    const written = o.wrong?.[nt.i] ?? nt.midi;
    const f = midiToFreq(written - 9) * Math.pow(2, (o.cents ?? 0) / 1200);
    const start = t0 + nt.beat * spb + (o.offset ?? 0);
    const tone = saxTone(f, nt.beats * spb * 0.88);
    out.set(tone, Math.floor(start * SR));
  }
  return out;
}

describe('sequence evaluation', () => {
  const abc = notesToAbc([67, 69, 71, 72, 74, 72, 71, 69], 1, { key: 'G', bpm: 90 });
  const score = parseScore(abc);
  const bpm = 90;
  const t0 = 0.5;

  it('gives a high score to an accurate performance', () => {
    const frames = analyzeBuffer(render(score, bpm, t0), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0 }, tol);
    expect(r.notes!.every((n) => n.judgment === 'perfect' || n.judgment === 'good')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.passed).toBe(true);
    expect(r.maxCombo).toBe(8);
  });

  it('detects a wrong note', () => {
    const frames = analyzeBuffer(render(score, bpm, t0, { wrong: { 3: 73 } }), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0 }, tol);
    expect(r.notes![3].judgment).toBe('wrong');
    expect(r.notes![3].played).toBe(73);
    expect(r.criteria.find((c) => c.id === 'pitch')!.score).toBe(88);
  });

  it('notices late playing', () => {
    const frames = analyzeBuffer(render(score, bpm, t0, { offset: 0.15 }), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0 }, tol);
    expect(Number(r.metrics.meanTimingMs)).toBeGreaterThan(100);
    expect(r.tips.join(' ')).toMatch(/опаздываете/);
    const rhythm = r.criteria.find((c) => c.id === 'rhythm')!;
    expect(rhythm.score).toBeLessThan(80);
  });

  it('compensates latency', () => {
    const frames = analyzeBuffer(render(score, bpm, t0, { offset: 0.15 }), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0.15 }, tol);
    expect(r.criteria.find((c) => c.id === 'rhythm')!.score).toBeGreaterThan(90);
  });

  it('measures intonation', () => {
    const frames = analyzeBuffer(render(score, bpm, t0, { cents: 35 }), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0 }, tol);
    expect(Number(r.metrics.meanCents)).toBeGreaterThan(25);
    expect(r.criteria.find((c) => c.id === 'intonation')!.score).toBeLessThan(80);
    expect(r.tips.join(' ')).toMatch(/завышен/);
  });

  it('scores silence as zero', () => {
    const frames = analyzeBuffer(new Float32Array(SR * 7), SR);
    const r = evaluateSequence(score, frames, { t0, bpm, latency: 0 }, tol);
    expect(r.score).toBeLessThan(20);
    expect(r.passed).toBe(false);
  });
});

describe('long tone', () => {
  it('rewards a steady 4 second tone', () => {
    const buf = new Float32Array(SR * 5);
    buf.set(saxTone(midiToFreq(67 - 9), 4.2), SR * 0.3);
    const r = evaluateLongTone(analyzeBuffer(buf, SR), 67, 4, tol);
    expect(r.score).toBeGreaterThan(90);
  });
  it('penalizes a short tone', () => {
    const buf = new Float32Array(SR * 5);
    buf.set(saxTone(midiToFreq(67 - 9), 1.5), SR * 0.3);
    const r = evaluateLongTone(analyzeBuffer(buf, SR), 67, 4, tol);
    expect(r.criteria.find((c) => c.id === 'duration')!.score).toBeLessThan(45);
  });
});

describe('vibrato', () => {
  it('measures rate and depth', () => {
    const buf = saxTone(midiToFreq(67 - 9), 4, SR, 0.3, { vibrato: { rate: 5.5, cents: 22 } });
    const r = evaluateVibrato(analyzeBuffer(buf, SR), 67, 4, [4.5, 6.5], [20, 60], tol);
    expect(Number(r.metrics.rateHz)).toBeGreaterThan(5);
    expect(Number(r.metrics.rateHz)).toBeLessThan(6);
    expect(Number(r.metrics.depthCents)).toBeGreaterThan(30);
    expect(Number(r.metrics.depthCents)).toBeLessThan(55);
    expect(r.score).toBeGreaterThan(80);
  });
  it('fails a plain tone', () => {
    const buf = saxTone(midiToFreq(67 - 9), 4);
    const r = evaluateVibrato(analyzeBuffer(buf, SR), 67, 4, [4.5, 6.5], [20, 60], tol);
    expect(r.passed).toBe(false);
  });
});

describe('dynamics', () => {
  it('recognizes a crescendo', () => {
    const tone = saxTone(midiToFreq(69 - 9), 4);
    for (let i = 0; i < tone.length; i++) tone[i] *= 0.08 + 0.92 * (i / tone.length);
    const r = evaluateDynamics(analyzeBuffer(tone, SR), 69, 'cresc', 4, tol);
    expect(r.criteria.find((c) => c.id === 'dynamics')!.score).toBeGreaterThan(80);
    const r2 = evaluateDynamics(analyzeBuffer(tone, SR), 69, 'dim', 4, tol);
    expect(r2.criteria.find((c) => c.id === 'dynamics')!.score).toBe(0);
  });
});

describe('mouthpiece', () => {
  it('accepts concert A5 for the mouthpiece alone', () => {
    const r = evaluateMouthpiece(analyzeBuffer(saxTone(880, 3), SR), 'mouthpiece', 3, tol);
    expect(r.score).toBeGreaterThan(85);
  });
  it('flags a low pitch', () => {
    const r = evaluateMouthpiece(analyzeBuffer(saxTone(700, 3), SR), 'mouthpiece', 3, tol);
    expect(r.passed).toBe(false);
  });
});

describe('breath', () => {
  it('measures an exhale', () => {
    const buf = new Float32Array(SR * 8);
    for (let i = SR; i < SR * 7; i++) buf[i] = 0.05 * (Math.random() * 2 - 1);
    const r = evaluateBreath(analyzeBuffer(buf, SR), 6, -80, tol);
    expect(Number(r.metrics.exhaleSec)).toBeGreaterThan(5.5);
    expect(r.passed).toBe(true);
  });
});

describe('improvisation', () => {
  it('likes scale notes on the grid with space', () => {
    const bpm = 100;
    const spb = 60 / bpm;
    const t0 = 0.5;
    const buf = new Float32Array(Math.floor(SR * (t0 + 8 * spb * 4 + 1)));
    // blues scale on written G: G Bb C Db D F
    const phrase = [67, 70, 72, 74, 72, 70, 67, 65];
    for (let bar = 0; bar < 8; bar += 2) {
      phrase.forEach((m, k) => {
        const start = t0 + (bar * 4 + k * 0.5) * spb;
        buf.set(saxTone(midiToFreq(m - 9), spb * 0.42), Math.floor(start * SR));
      });
    }
    const frames = analyzeBuffer(buf, SR);
    const r = evaluateImprov(frames, { t0, bpm, beatsPerBar: 4, bars: 8, chords: [['G7'], ['C7']], scale: { root: 7, type: 'blues' }, latency: 0 }, tol);
    expect(Number(r.metrics.scaleAdherence)).toBeGreaterThan(90);
    expect(r.score).toBeGreaterThan(60);
  });
});

describe('helpers', () => {
  it('aligns sequences', () => {
    expect(alignSequence([60, 62, 64], [60, 64])).toEqual([
      [0, 0],
      [2, 1],
    ]);
  });
  it('computes arcade combos', () => {
    const r = arcade(['perfect', 'good', 'miss', 'perfect']);
    expect(r.maxCombo).toBe(2);
    expect(r.points).toBe(270);
  });
  it('evaluates wait-mode records', () => {
    const r = evaluateWait(
      [
        { expected: 67, reaction: 1, wrongAttempts: 0, cents: 5, std: 3 },
        { expected: 69, reaction: 2, wrongAttempts: 1, cents: -10, std: 3 },
      ],
      tol,
      2,
      10,
    );
    expect(r.criteria.find((c) => c.id === 'pitch')!.score).toBe(50);
  });
});
