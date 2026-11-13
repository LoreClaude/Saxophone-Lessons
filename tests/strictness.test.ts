// Scores must not be generous: room noise is not an exhale, uneven sound and
// wrong or extra notes must visibly lower the result.
import { describe, expect, it } from 'vitest';
import { analyzeBuffer } from '../src/audio/dsp';
import { evaluateBreath, evaluateLongTone, evaluateSequence, roomLevel } from '../src/practice/evaluate';
import { tolerances } from '../src/practice/types';
import { parseScore, notesToAbc } from '../src/music/abc';
import { midiToFreq } from '../src/music/notes';
import { saxTone, SR } from './helpers/audio';

const tier1 = tolerances(1);

/** Low-frequency room rumble plus white microphone self-noise. */
function room(seconds: number, level = 0.02) {
  const out = new Float32Array(Math.floor(seconds * SR));
  let b = 0;
  for (let i = 0; i < out.length; i++) {
    b = 0.985 * b + 0.015 * (Math.random() * 2 - 1);
    out[i] = level * 8 * b + 0.0015 * (Math.random() * 2 - 1);
  }
  return out;
}

/** "ссс": bright broadband hiss (first-difference of white noise). */
function hiss(seconds: number, amp = 0.08, mod?: (t: number) => number) {
  const out = new Float32Array(Math.floor(seconds * SR));
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const w = Math.random() * 2 - 1;
    const t = i / SR;
    const env = Math.min(1, t / 0.15) * Math.min(1, (seconds - t) / 0.15);
    out[i] = amp * env * (mod ? mod(t) : 1) * (w - prev);
    prev = w;
  }
  return out;
}

function mix(a: Float32Array, b: Float32Array, offsetSec = 0) {
  const out = a.slice();
  const off = Math.floor(offsetSec * SR);
  for (let i = 0; i < b.length && off + i < out.length; i++) out[off + i] += b[i];
  return out;
}

describe('breath', () => {
  const pre = analyzeBuffer(room(1.5), SR);
  const roomDb = roomLevel(pre, -70);

  it('does not count room noise as an exhale', () => {
    const r = evaluateBreath(analyzeBuffer(room(9), SR), 8, roomDb, tier1);
    expect(r.score).toBeLessThan(10);
    expect(r.passed).toBe(false);
  });

  it('does not count room noise even with a badly calibrated noise floor', () => {
    // the old code used the stored floor (−70 dB by default) as the reference
    const r = evaluateBreath(analyzeBuffer(room(9), SR), 8, roomLevel(analyzeBuffer(room(1.5), SR), -70), tier1);
    expect(r.passed).toBe(false);
  });

  it('accepts a steady "sss" exhale', () => {
    const buf = mix(room(9), hiss(8.3), 0.3);
    const r = evaluateBreath(analyzeBuffer(buf, SR), 8, roomDb, tier1);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.passed).toBe(true);
  });

  it('penalizes an uneven exhale', () => {
    const buf = mix(room(9), hiss(8.3, 0.08, (t) => Math.pow(10, (7 * Math.sin(2 * Math.PI * 0.6 * t)) / 20)), 0.3);
    const r = evaluateBreath(analyzeBuffer(buf, SR), 8, roomDb, tier1);
    expect(r.score).toBeLessThan(85);
    expect(r.stars).toBeLessThan(3);
  });

  it('penalizes a break in the middle', () => {
    const buf = mix(mix(room(9), hiss(3.5), 0.3), hiss(3.5), 4.8);
    const r = evaluateBreath(analyzeBuffer(buf, SR), 8, roomDb, tier1);
    expect(r.score).toBeLessThan(70);
  });
});

describe('long tone evenness', () => {
  function wobbly(seconds: number) {
    const f0 = midiToFreq(67 - 9);
    const n = Math.floor(seconds * SR);
    const out = new Float32Array(n);
    let phase = 0;
    let drift = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      if (i % 2400 === 0) drift = Math.max(-35, Math.min(35, drift + (Math.random() * 2 - 1) * 15));
      const f = f0 * Math.pow(2, drift / 1200);
      phase += (2 * Math.PI * f) / SR;
      const loud = Math.pow(10, (5 * Math.sin(2 * Math.PI * 0.7 * t)) / 20);
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(phase * h) / h;
      out[i] = 0.12 * loud * s * Math.min(1, t / 0.05) * Math.min(1, (seconds - t) / 0.05);
    }
    return out;
  }

  it('an uneven tone cannot get 100 % or three stars', () => {
    const r = evaluateLongTone(analyzeBuffer(wobbly(4.5), SR), 67, 4, tier1);
    expect(r.score).toBeLessThan(85);
    expect(r.stars).toBeLessThan(3);
  });

  it('a steady tone still scores high', () => {
    const buf = new Float32Array(SR * 5);
    buf.set(saxTone(midiToFreq(67 - 9), 4.2), SR * 0.3);
    const r = evaluateLongTone(analyzeBuffer(buf, SR), 67, 4, tier1);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
});

describe('sequence with extra notes', () => {
  it('slips between the notes lower the score', () => {
    const abc = notesToAbc([67, 69, 71, 72, 74, 72, 71, 69], 1, { key: 'G', bpm: 72 });
    const score = parseScore(abc);
    const spb = 60 / 72;
    const t0 = 0.5;
    const out = new Float32Array(Math.floor((t0 + 9 * spb + 1) * SR));
    for (const nt of score.notes) {
      const start = t0 + nt.beat * spb;
      // each note: a short wrong note (slip) then the right one
      out.set(saxTone(midiToFreq(nt.midi + 2 - 9), 0.18), Math.floor(start * SR));
      out.set(saxTone(midiToFreq(nt.midi - 9), spb * 0.6), Math.floor((start + 0.22) * SR));
    }
    const r = evaluateSequence(score, analyzeBuffer(out, SR), { t0, bpm: 72, latency: 0 }, tier1);
    expect(r.criteria.find((c) => c.id === 'pitch')!.score).toBeLessThan(100);
    expect(r.score).toBeLessThan(95);
  });
});
