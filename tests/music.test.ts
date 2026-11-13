import { describe, expect, it } from 'vitest';
import {
  fullNoteNameRu,
  noteLabelRu,
  noteNameRu,
  parseSci,
  writtenToConcert,
  concertToWritten,
  freqToMidi,
  midiToFreq,
  SAX_HIGH,
  SAX_LOW,
} from '../src/music/notes';
import { FINGERINGS, describeFingering, mainFingering } from '../src/music/fingering';
import { parseChord, scaleNotes, keySig, spell, transposeChordSymbol, parseChordChart } from '../src/music/theory';
import { buildAbc, parseScore, notesToAbc } from '../src/music/abc';

describe('notes', () => {
  it('names notes in Russian', () => {
    expect(noteNameRu(60)).toBe('До');
    expect(noteNameRu(70)).toBe('Си♭');
    expect(noteNameRu(66)).toBe('Фа♯');
    expect(fullNoteNameRu(74)).toBe('Ре второй октавы');
    expect(fullNoteNameRu(58)).toBe('Си-бемоль малой октавы');
    expect(noteLabelRu(62)).toBe('Ре¹');
  });
  it('parses scientific names', () => {
    expect(parseSci('C4')).toBe(60);
    expect(parseSci('Bb3')).toBe(58);
    expect(parseSci('F#6')).toBe(90);
  });
  it('transposes alto sax a major sixth', () => {
    expect(writtenToConcert(72)).toBe(63); // written C5 sounds E♭4
    expect(concertToWritten(63)).toBe(72);
    expect(writtenToConcert(SAX_LOW)).toBe(49); // D♭3
    expect(writtenToConcert(SAX_HIGH)).toBe(81); // A5
  });
  it('converts frequency', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(freqToMidi(880)).toBeCloseTo(81);
    expect(freqToMidi(442, 442)).toBeCloseTo(69);
  });
});

describe('fingerings', () => {
  it('cover the whole standard range', () => {
    for (let m = SAX_LOW; m <= SAX_HIGH; m++) {
      expect(FINGERINGS[m]?.length, `note ${m}`).toBeGreaterThan(0);
    }
  });
  it('use the octave key from D5 up', () => {
    for (let m = SAX_LOW; m <= SAX_HIGH; m++) {
      const f = mainFingering(m)!;
      expect(f.keys.includes('oct'), `note ${m}`).toBe(m >= 74);
    }
  });
  it('describe a fingering', () => {
    expect(describeFingering(mainFingering(67)!)).toBe('левая: 1 2 3');
    expect(describeFingering(mainFingering(73)!)).toBe('все клапаны открыты');
  });
});

describe('theory', () => {
  it('builds scales', () => {
    expect(scaleNotes(60, 'major')).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(scaleNotes(60, 'blues')).toEqual([60, 63, 65, 66, 67, 70, 72]);
  });
  it('parses chords', () => {
    expect(parseChord('C7').intervals).toEqual([0, 4, 7, 10]);
    expect(parseChord('Bbmaj7').rootPc).toBe(10);
    expect(parseChord('F#m7b5').intervals).toEqual([0, 3, 6, 10]);
    expect(parseChord('Am').intervals).toEqual([0, 3, 7]);
    expect(parseChord('G').intervals).toEqual([0, 4, 7]);
  });
  it('transposes chord symbols', () => {
    expect(transposeChordSymbol('G7', -9)).toBe('Bb7');
    expect(transposeChordSymbol('Am7', -9)).toBe('C' + 'm7');
  });
  it('parses chord charts', () => {
    expect(parseChordChart('| C7 | F7 G7 |')).toEqual([['C7'], ['F7', 'G7']]);
  });
  it('spells notes in keys', () => {
    expect(spell(66, keySig('G'))).toEqual({ letter: 'F', acc: 1, octave: 4 });
    expect(spell(70, keySig('F'))).toEqual({ letter: 'B', acc: -1, octave: 4 });
    expect(spell(70, keySig('C'))).toEqual({ letter: 'B', acc: -1, octave: 4 });
    expect(spell(61, keySig('C'))).toEqual({ letter: 'C', acc: 1, octave: 4 });
    expect(spell(72, keySig('C'))).toEqual({ letter: 'C', acc: 0, octave: 5 });
  });
});

describe('abc round trip', () => {
  it('keeps pitches and durations', () => {
    const notes = [62, 64, 66, 67, 69, 71, 73, 74];
    const abc = notesToAbc(notes, 1, { key: 'D', bpm: 90 });
    const s = parseScore(abc);
    expect(s.notes.map((x) => x.midi)).toEqual(notes);
    expect(s.notes.map((x) => x.beat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(s.bpm).toBe(90);
    expect(s.beatsPerBar).toBe(4);
    expect(s.totalBeats).toBe(8);
  });
  it('handles accidentals inside a bar and across bars', () => {
    const notes = [61, 60, 61, 61, 60, 59, 58, 59];
    const abc = notesToAbc(notes, 1, { key: 'C' });
    const s = parseScore(abc);
    expect(s.notes.map((x) => x.midi)).toEqual(notes);
  });
  it('ties notes across bar lines', () => {
    const abc = buildAbc(
      [
        { midi: 67, beats: 3 },
        { midi: 69, beats: 2 },
        { midi: 71, beats: 3 },
      ],
      { key: 'C' },
    );
    expect(abc).toContain('-');
    const s = parseScore(abc);
    expect(s.notes.map((x) => [x.midi, x.beat, x.beats])).toEqual([
      [67, 0, 3],
      [69, 3, 2],
      [71, 5, 3],
    ]);
    expect(s.notes[1].tieChars.length).toBe(1);
  });
  it('reads articulation, slurs and dynamics', () => {
    const abc = buildAbc(
      [
        { midi: 67, beats: 1, dynamic: 'p', slurStart: true },
        { midi: 69, beats: 1 },
        { midi: 71, beats: 1, slurEnd: true },
        { midi: 72, beats: 1, staccato: true, accent: true },
      ],
      { key: 'C' },
    );
    const s = parseScore(abc);
    expect(s.notes[0].dynamic).toBe('p');
    expect(s.notes.map((x) => x.slurred)).toEqual([false, true, true, false]);
    expect(s.notes[3].staccato).toBe(true);
    expect(s.notes[3].accent).toBe(true);
  });
  it('shifts pickup notes to the end of the first bar', () => {
    const s = parseScore('X:1\nM:4/4\nL:1/4\nK:C\nG A | B c d e |]\n');
    expect(s.notes[0].beat).toBe(2);
    expect(s.notes[2].beat).toBe(4);
  });
  it('supports 6/8 with dotted quarter beat', () => {
    const s = parseScore('X:1\nM:6/8\nL:1/8\nQ:3/8=60\nK:C\nCDE FGA | c6 |]\n');
    expect(s.beatsPerBar).toBe(2);
    expect(s.notes[3].beat).toBeCloseTo(1);
    expect(s.notes[6].beats).toBeCloseTo(2);
  });
});
