// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { zipSync, strToU8 } from 'fflate';
import { parseMusicXml, parseMidi, partToAbc, readMxl, bestOctaveShift } from '../src/music/importers';
import { parseScore } from '../src/music/abc';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Тест</work-title></work>
  <part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="96"/></direction>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><rest/><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice><tie type="start"/></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><tie type="stop"/></note>
      <note><pitch><step>F</step><alter>1</alter><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure>
  </part>
</score-partwise>`;

describe('MusicXML import', () => {
  it('reads notes, rests, ties and tempo', () => {
    const r = parseMusicXml(XML);
    expect(r.title).toBe('Тест');
    const p = r.parts[0];
    expect(p.bpm).toBe(96);
    expect(p.isWritten).toBe(false);
    expect(p.notes).toEqual([
      { midi: 72, beats: 1 },
      { midi: 74, beats: 1 },
      { midi: null, beats: 1 },
      { midi: 76, beats: 3 },
      { midi: 78, beats: 2 },
    ]);
  });
  it('transposes concert pitch for alto and keeps rhythm', () => {
    const p = parseMusicXml(XML).parts[0];
    const { abc, outOfRange } = partToAbc(p, { concert: true, title: 'Тест', bpm: 96, meter: [4, 4] });
    const s = parseScore(abc);
    // concert C5 → written A5 (+9), maybe octave-shifted into the alto range
    const first = s.notes[0].midi;
    expect((((first - 81) % 12) + 12) % 12).toBe(0);
    expect(s.notes.map((n) => n.beats)).toEqual([1, 1, 3, 2]);
    expect(outOfRange).toBe(0);
  });
  it('recognizes written alto parts', () => {
    const xml = XML.replace('<time>', '<transpose><diatonic>-5</diatonic><chromatic>-9</chromatic></transpose><time>');
    expect(parseMusicXml(xml).parts[0].isWritten).toBe(true);
  });
  it('unpacks .mxl archives', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'),
      'score.xml': strToU8(XML),
    });
    expect(readMxl(zip)).toContain('score-partwise');
  });
});

describe('MIDI import', () => {
  it('reads a melody track', () => {
    const m = new Midi();
    m.header.setTempo(120);
    const t = m.addTrack();
    t.name = 'Melody';
    [60, 62, 64, 65].forEach((n, i) => t.addNote({ midi: n, time: i * 0.5, duration: 0.45 }));
    const r = parseMidi(m.toArray().buffer as ArrayBuffer);
    const p = r.parts[0];
    expect(p.bpm).toBe(120);
    expect(p.notes.filter((x) => x.midi !== null).map((x) => x.midi)).toEqual([60, 62, 64, 65]);
    expect(p.notes.every((x) => x.beats >= 0.25)).toBe(true);
  });
});

describe('range fitting', () => {
  it('moves notes into the alto range', () => {
    expect(bestOctaveShift([40, 42, 45])).toBe(24);
    expect(bestOctaveShift([70, 72, 74])).toBe(0);
  });
});
