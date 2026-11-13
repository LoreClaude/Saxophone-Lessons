import { describe, expect, it } from 'vitest';
import { analyzeBuffer, yin } from '../src/audio/dsp';
import { segmentNotes, median } from '../src/audio/segment';
import { midiToFreq } from '../src/music/notes';
import { concat, decode, hasFfmpeg, legato, sampleFiles, saxTone, silence, SR } from './helpers/audio';

describe('yin', () => {
  it('detects a sine', () => {
    const n = 2048;
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / SR);
    const r = yin(buf, SR);
    expect(1200 * Math.log2(r.f0 / 440)).toBeLessThan(3);
    expect(r.clarity).toBeGreaterThan(0.95);
  });

  it('tracks synthetic saxophone tones over the whole alto range', () => {
    for (let m = 49; m <= 81; m++) {
      const tone = saxTone(midiToFreq(m), 0.5);
      const frames = analyzeBuffer(tone, SR).slice(4, -4);
      const voiced = frames.filter((f) => f.voiced);
      expect(voiced.length / frames.length, `voicing ${m}`).toBeGreaterThan(0.9);
      const med = median(voiced.map((f) => f.midi));
      expect(Math.abs(med - m), `pitch ${m}`).toBeLessThan(0.1);
    }
  });

  it('treats breath noise as unvoiced and flat', () => {
    const noise = new Float32Array(SR);
    for (let i = 0; i < noise.length; i++) noise[i] = 0.1 * (Math.random() * 2 - 1);
    const frames = analyzeBuffer(noise, SR);
    expect(frames.filter((f) => f.voiced).length / frames.length).toBeLessThan(0.05);
    expect(median(frames.map((f) => f.flatness))).toBeGreaterThan(0.5);
  });
});

describe.runIf(hasFfmpeg())('real alto saxophone recordings', () => {
  const files = sampleFiles();
  it('has the full chromatic set of samples', () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });
  for (const { file, midi } of files) {
    it(`detects ${file.split('/').pop()} as MIDI ${midi}`, () => {
      const pcm = decode(file);
      const part = pcm.subarray(Math.floor(0.25 * SR), Math.floor(3.5 * SR));
      const frames = analyzeBuffer(part, SR);
      const voiced = frames.filter((f) => f.voiced);
      expect(voiced.length / frames.length).toBeGreaterThan(0.85);
      const med = median(voiced.map((f) => f.midi));
      expect(Math.round(med)).toBe(midi);
      // octave errors must be rare
      const wrong = voiced.filter((f) => Math.abs(Math.round(f.midi) - midi) >= 1).length;
      expect(wrong / voiced.length).toBeLessThan(0.05);
    });
  }
});

describe('segmentation', () => {
  it('splits tongued notes separated by short gaps', () => {
    const seq = [67, 69, 71, 72].map((m) => midiToFreq(m - 9));
    const parts: Float32Array[] = [silence(0.2)];
    for (const f of seq) {
      parts.push(saxTone(f, 0.4));
      parts.push(silence(0.06));
    }
    const frames = analyzeBuffer(concat(parts), SR);
    const notes = segmentNotes(frames);
    expect(notes.map((x) => x.midi + 9)).toEqual([67, 69, 71, 72]);
    expect(notes.every((x) => x.attack === 'tongued')).toBe(true);
    for (const nt of notes) expect(nt.end - nt.start).toBeGreaterThan(0.3);
  });

  it('detects slurred (legato) note changes', () => {
    const freqs = [60, 62, 64, 65].map((m) => midiToFreq(m));
    const frames = analyzeBuffer(concat([silence(0.1), legato(freqs, 0.35), silence(0.1)]), SR);
    const notes = segmentNotes(frames);
    expect(notes.map((x) => x.midi)).toEqual([60, 62, 64, 65]);
    expect(notes.slice(1).every((x) => x.attack === 'slurred')).toBe(true);
  });

  it('measures intonation in cents', () => {
    const f = midiToFreq(69) * Math.pow(2, 20 / 1200); // 20 cents sharp
    const frames = analyzeBuffer(saxTone(f, 1), SR);
    const notes = segmentNotes(frames);
    expect(notes.length).toBe(1);
    expect(notes[0].cents).toBeGreaterThan(15);
    expect(notes[0].cents).toBeLessThan(25);
    expect(notes[0].stdCents).toBeLessThan(3);
  });

  it('sees vibrato as pitch variation, not as new notes', () => {
    const frames = analyzeBuffer(saxTone(midiToFreq(67), 2, SR, 0.3, { vibrato: { rate: 5.5, cents: 25 } }), SR);
    const notes = segmentNotes(frames);
    expect(notes.length).toBe(1);
    expect(notes[0].stdCents).toBeGreaterThan(10);
  });
});
