// Plays content demos (notes, ABC phrases, intervals, chords, backing).
import type { Demo } from '../content/types';
import { audio } from '../audio/engine';
import { instruments } from '../audio/sampler';
import { playMelody, playSaxNote, startSession, type Session } from '../audio/backing';
import { parseScore } from '../music/abc';
import { parseChordChart } from '../music/theory';
import { ALTO_TRANSPOSE } from '../music/notes';
import { getSettings } from '../store/settings';

let current: { stop(): void } | null = null;

export function stopDemo() {
  current?.stop();
  current = null;
}

export async function playDemo(d: Demo): Promise<number> {
  stopDemo();
  await audio.ensureContext();
  const s = getSettings();
  switch (d.kind) {
    case 'note': {
      const secs = d.seconds ?? 1.4;
      const v = await playSaxNote(d.note, secs, { vibrato: d.vibrato, detune: d.detune });
      current = v;
      return secs;
    }
    case 'interval': {
      await instruments.sax.load();
      const t = audio.now() + 0.05;
      const a = instruments.sax.play(d.a + ALTO_TRANSPOSE, t, d.harmonic ? 1.6 : 0.8);
      const b = instruments.sax.play(d.b + ALTO_TRANSPOSE, d.harmonic ? t : t + 0.85, d.harmonic ? 1.6 : 0.9);
      current = { stop: () => (a.stop(), b.stop()) };
      return d.harmonic ? 1.7 : 1.8;
    }
    case 'chord': {
      await instruments.piano.load();
      const t = audio.now() + 0.05;
      const vs = d.notes.map((m) => instruments.piano.play(m + ALTO_TRANSPOSE, t, 1.6, { velocity: 0.6 }));
      current = { stop: () => vs.forEach((v) => v.stop()) };
      return 1.8;
    }
    case 'abc': {
      const score = parseScore(d.abc);
      const bpm = d.bpm ?? score.bpm;
      let sess: Session;
      if (d.style || d.metronome) {
        sess = await startSession({
          bpm,
          beatsPerBar: score.beatsPerBar,
          countInBars: d.metronome || d.style ? 1 : 0,
          totalBeats: score.totalBeats,
          metronome: Boolean(d.metronome),
          metronomeVolume: s.metronomeVolume,
          style: d.style,
          chords: d.chords ? parseChordChart(d.chords) : undefined,
          backingVolume: s.backingVolume,
          melody: score,
          melodyVolume: s.melodyVolume,
          swingMelody: d.swing,
        });
      } else {
        sess = await playMelody(score, bpm, { swingMelody: d.swing, melodyVolume: s.melodyVolume });
      }
      current = sess;
      const countIn = d.metronome || d.style ? score.beatsPerBar : 0;
      return ((score.totalBeats + countIn) * 60) / bpm + 0.5;
    }
    case 'backing': {
      const sess = await startSession({
        bpm: d.bpm,
        beatsPerBar: 4,
        countInBars: 1,
        totalBeats: d.bars * 4,
        style: d.style,
        chords: parseChordChart(d.chords),
        backingVolume: s.backingVolume,
      });
      current = sess;
      return ((d.bars + 1) * 4 * 60) / d.bpm;
    }
  }
}
