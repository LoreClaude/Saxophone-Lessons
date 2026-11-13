// Import of user sheet music: MusicXML (.musicxml/.xml/.mxl), MIDI and ABC.
// Everything is reduced to a single melodic line in WRITTEN alto pitch.
import { unzipSync, strFromU8 } from 'fflate';
import { Midi } from '@tonejs/midi';
import { buildAbc, type BuildNote } from './abc';
import { ALTO_TRANSPOSE, SAX_HIGH, SAX_LOW, pitchClass } from './notes';
import { keyFor } from './theory';

export interface ImportedNote {
  /** Concert or written MIDI depending on `isWritten`; null = rest. */
  midi: number | null;
  /** Duration in quarter beats. */
  beats: number;
}

export interface ImportedPart {
  id: string;
  name: string;
  notes: ImportedNote[];
  /** True if the pitches are already written for an E♭ alto saxophone. */
  isWritten: boolean;
  /** Key signature in fifths (as found in the file, if any). */
  fifths?: number;
  meter: [number, number];
  bpm: number;
  polyphonic: boolean;
}

export interface ImportResult {
  title: string;
  parts: ImportedPart[];
}

// ---------------------------------------------------------------------------
// MusicXML
// ---------------------------------------------------------------------------

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseMusicXml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Файл MusicXML повреждён');
  const title = doc.querySelector('work-title')?.textContent?.trim() || doc.querySelector('movement-title')?.textContent?.trim() || 'Без названия';
  const names = new Map<string, string>();
  doc.querySelectorAll('score-part').forEach((sp) => names.set(sp.getAttribute('id') || '', sp.querySelector('part-name')?.textContent?.trim() || ''));
  const parts: ImportedPart[] = [];
  doc.querySelectorAll('part').forEach((part) => {
    const id = part.getAttribute('id') || `P${parts.length + 1}`;
    let divisions = 1;
    let chromatic = 0;
    let fifths: number | undefined;
    let meter: [number, number] = [4, 4];
    let bpm = 0;
    let polyphonic = false;
    const notes: ImportedNote[] = [];
    let lastStartIdx = -1;
    part.querySelectorAll(':scope > measure').forEach((measure) => {
      for (const el of Array.from(measure.children)) {
        const tag = el.tagName;
        if (tag === 'attributes') {
          const d = el.querySelector('divisions')?.textContent;
          if (d) divisions = Number(d) || divisions;
          const c = el.querySelector('transpose > chromatic')?.textContent;
          if (c !== undefined && c !== null) chromatic = Number(c) || 0;
          const f = el.querySelector('key > fifths')?.textContent;
          if (f !== undefined && f !== null && fifths === undefined) fifths = Number(f);
          const b = el.querySelector('time > beats')?.textContent;
          const bt = el.querySelector('time > beat-type')?.textContent;
          if (b && bt) meter = [Number(b) || 4, Number(bt) || 4];
        } else if (tag === 'direction' || tag === 'sound') {
          const s = tag === 'sound' ? el : el.querySelector('sound');
          const t = s?.getAttribute('tempo');
          if (t && !bpm) bpm = Math.round(Number(t));
          const pm = el.querySelector('per-minute')?.textContent;
          if (pm && !bpm) bpm = Math.round(Number(pm));
        } else if (tag === 'note') {
          if (el.querySelector('grace')) continue;
          const voice = el.querySelector('voice')?.textContent;
          if (voice && voice !== '1') {
            polyphonic = true;
            continue;
          }
          const dur = Number(el.querySelector(':scope > duration')?.textContent || 0) / divisions;
          const isChord = Boolean(el.querySelector(':scope > chord'));
          const isRest = Boolean(el.querySelector(':scope > rest'));
          let midi: number | null = null;
          if (!isRest) {
            const step = el.querySelector('pitch > step')?.textContent || 'C';
            const alter = Number(el.querySelector('pitch > alter')?.textContent || 0);
            const octave = Number(el.querySelector('pitch > octave')?.textContent || 4);
            midi = (octave + 1) * 12 + STEP_PC[step] + Math.round(alter);
          }
          if (isChord) {
            polyphonic = true;
            // keep the highest note of a chord
            if (midi !== null && lastStartIdx >= 0 && (notes[lastStartIdx].midi ?? -1) < midi) notes[lastStartIdx].midi = midi;
            continue;
          }
          const tieStop = Array.from(el.querySelectorAll('tie')).some((t) => t.getAttribute('type') === 'stop');
          const prev = notes[notes.length - 1];
          if (tieStop && prev && prev.midi === midi) {
            prev.beats += dur;
          } else {
            notes.push({ midi, beats: dur });
            lastStartIdx = notes.length - 1;
          }
        } else if (tag === 'backup') {
          polyphonic = true;
          break; // ignore further voices in this measure
        }
      }
    });
    // A written part for an E♭ instrument carries <transpose><chromatic>-9 (or +3).
    const isWritten = chromatic === -9 || chromatic === 3;
    parts.push({ id, name: names.get(id) || id, notes, isWritten, fifths, meter, bpm: bpm || 90, polyphonic });
  });
  if (!parts.length) throw new Error('В файле не найдено ни одной партии');
  return { title, parts };
}

export function readMxl(data: Uint8Array): string {
  const files = unzipSync(data);
  const container = files['META-INF/container.xml'];
  if (container) {
    const m = /full-path="([^"]+)"/.exec(strFromU8(container));
    if (m && files[m[1]]) return strFromU8(files[m[1]]);
  }
  const xmlName = Object.keys(files).find((f) => f.endsWith('.xml') && !f.startsWith('META-INF'));
  if (!xmlName) throw new Error('В архиве .mxl нет MusicXML');
  return strFromU8(files[xmlName]);
}

// ---------------------------------------------------------------------------
// MIDI
// ---------------------------------------------------------------------------

export function parseMidi(data: ArrayBuffer): ImportResult {
  const midi = new Midi(data);
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 100);
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const ppq = midi.header.ppq;
  const parts: ImportedPart[] = [];
  midi.tracks.forEach((tr, ti) => {
    if (!tr.notes.length || tr.instrument.percussion) return;
    const sorted = [...tr.notes].sort((a, b) => a.ticks - b.ticks || b.midi - a.midi);
    const q = (ticks: number) => Math.round((ticks / ppq) * 4) / 4; // sixteenth grid
    const notes: ImportedNote[] = [];
    let pos = 0;
    let polyphonic = false;
    for (let i = 0; i < sorted.length; i++) {
      const nt = sorted[i];
      const start = q(nt.ticks);
      if (start < pos - 1e-6) {
        polyphonic = true;
        continue; // overlapping / chord note: keep the first (highest) one
      }
      let end = q(nt.ticks + nt.durationTicks);
      const next = sorted.slice(i + 1).find((x) => q(x.ticks) > start);
      if (next && q(next.ticks) < end) end = q(next.ticks);
      if (end - start < 0.25) end = start + 0.25;
      if (start > pos) notes.push({ midi: null, beats: start - pos });
      notes.push({ midi: nt.midi, beats: end - start });
      pos = end;
    }
    parts.push({ id: `T${ti}`, name: tr.name || tr.instrument.name || `Дорожка ${ti + 1}`, notes, isWritten: false, meter: [ts[0], ts[1]], bpm, polyphonic });
  });
  if (!parts.length) throw new Error('В MIDI-файле нет нот');
  return { title: midi.name || 'MIDI', parts };
}

// ---------------------------------------------------------------------------
// Conversion to alto ABC
// ---------------------------------------------------------------------------

/** Octave shift (multiple of 12) that fits most notes into the alto range. */
export function bestOctaveShift(midis: number[]): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let k = -3; k <= 3; k++) {
    const sh = k * 12;
    const inRange = midis.filter((m) => m + sh >= SAX_LOW && m + sh <= SAX_HIGH).length;
    const center = midis.length ? midis.reduce((a, b) => a + b + sh, 0) / midis.length : 74;
    const score = inRange * 100 - Math.abs(center - 72);
    if (score > bestScore) {
      bestScore = score;
      best = sh;
    }
  }
  return best;
}

/** Major key (in written pitch) that best covers the notes. */
export function guessKey(midis: number[]): string {
  const pcs = new Map<number, number>();
  midis.forEach((m) => pcs.set(pitchClass(m), (pcs.get(pitchClass(m)) ?? 0) + 1));
  let best = 'C';
  let bestScore = -1;
  for (let t = 0; t < 12; t++) {
    const k = keyFor(t, false);
    const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => (t + s) % 12);
    const cover = scale.reduce((a, pc) => a + (pcs.get(pc) ?? 0), 0) - Math.abs(k.accidentals) * 0.01;
    if (cover > bestScore) {
      bestScore = cover;
      best = k.abc;
    }
  }
  return best;
}

export interface ToAbcOptions {
  /** Treat the source as concert pitch (piano, guitar, voice) and transpose for alto. */
  concert: boolean;
  title: string;
  bpm: number;
  meter: [number, number];
  /** Extra octave shift after automatic fitting. */
  octave?: number;
}

export function partToAbc(part: ImportedPart, o: ToAbcOptions): { abc: string; outOfRange: number } {
  const transpose = o.concert ? -ALTO_TRANSPOSE : 0;
  const raw = part.notes.filter((n) => n.midi !== null).map((n) => n.midi! + transpose);
  const shift = bestOctaveShift(raw) + (o.octave ?? 0) * 12;
  const notes: BuildNote[] = part.notes.map((n) => ({ midi: n.midi === null ? null : n.midi + transpose + shift, beats: n.beats }));
  // drop leading/trailing rests
  while (notes.length && notes[0].midi === null) notes.shift();
  while (notes.length && notes[notes.length - 1].midi === null) notes.pop();
  const written = notes.filter((n) => n.midi !== null).map((n) => n.midi!);
  const outOfRange = written.filter((m) => m < SAX_LOW || m > SAX_HIGH).length;
  const key = guessKey(written);
  return { abc: buildAbc(notes, { key, meter: o.meter, bpm: o.bpm, title: o.title }), outOfRange };
}
