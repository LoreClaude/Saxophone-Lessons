// Note names, MIDI helpers and alto saxophone transposition.
//
// Conventions used across the app:
//  * "written" pitch = what the saxophonist reads and fingers (alto part).
//  * "concert" pitch = what actually sounds (piano pitch).
//  * Alto saxophone in E♭ sounds a major sixth lower than written:
//      concert = written - 9 semitones.

export const ALTO_TRANSPOSE = -9;

/** Lowest/highest written notes of the alto sax (standard range, no altissimo). */
export const SAX_LOW = 58; // B♭3 written
export const SAX_HIGH = 90; // F♯6 written

export const writtenToConcert = (m: number) => m + ALTO_TRANSPOSE;
export const concertToWritten = (m: number) => m - ALTO_TRANSPOSE;

export const midiToFreq = (m: number, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f: number, a4 = 440) => 69 + 12 * Math.log2(f / a4);

const RU_SHARP = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];
const RU_FLAT = ['До', 'Ре♭', 'Ре', 'Ми♭', 'Ми', 'Фа', 'Соль♭', 'Соль', 'Ля♭', 'Ля', 'Си♭', 'Си'];
/** The spelling saxophonists see most often: C♯, E♭, F♯, G♯, B♭. */
const RU_SAX = ['До', 'До♯', 'Ре', 'Ми♭', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Си♭', 'Си'];

const EN_SAX = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

export type Spelling = 'sax' | 'sharp' | 'flat';

export function pitchClass(m: number) {
  return ((Math.round(m) % 12) + 12) % 12;
}

/** Short Russian name without octave: «Си♭». */
export function noteNameRu(m: number, spelling: Spelling = 'sax') {
  const pc = pitchClass(m);
  const table = spelling === 'sharp' ? RU_SHARP : spelling === 'flat' ? RU_FLAT : RU_SAX;
  return table[pc];
}

/** Long Russian name: «Си-бемоль», «Фа-диез». */
export function noteNameRuLong(m: number, spelling: Spelling = 'sax') {
  return noteNameRu(m, spelling).replace('♯', '-диез').replace('♭', '-бемоль');
}

export function noteNameEn(m: number) {
  return EN_SAX[pitchClass(m)];
}

/** Scientific octave number (C4 = middle C = 60). */
export function octaveOf(m: number) {
  return Math.floor(Math.round(m) / 12) - 1;
}

/** Russian octave name for the scientific octave number. */
export function octaveNameRu(m: number) {
  const o = octaveOf(m);
  switch (o) {
    case 1:
      return 'контроктавы';
    case 2:
      return 'большой октавы';
    case 3:
      return 'малой октавы';
    case 4:
      return 'первой октавы';
    case 5:
      return 'второй октавы';
    case 6:
      return 'третьей октавы';
    case 7:
      return 'четвёртой октавы';
    default:
      return '';
  }
}

/** «Ре второй октавы». */
export function fullNoteNameRu(m: number, spelling: Spelling = 'sax') {
  return `${noteNameRuLong(m, spelling)} ${octaveNameRu(m)}`.trim();
}

/** Compact label with octave digit as in Russian school notation: «Ре²». */
export function noteLabelRu(m: number, spelling: Spelling = 'sax') {
  const o = octaveOf(m) - 3; // 1st octave = 1
  const sup = ['⁰', '¹', '²', '³', '⁴'];
  const suffix = o >= 1 && o <= 4 ? sup[o] : o === 0 ? ' м.' : '';
  return `${noteNameRu(m, spelling)}${suffix}`;
}

/** Scientific name used internally, e.g. "Bb3", "F#5". */
export function sciName(m: number) {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  return `${names[pitchClass(m)]}${octaveOf(m)}`;
}

/** Parses "C4", "C#4", "Db4", "Bb3", "F#5" → MIDI. */
export function parseSci(name: string): number {
  const m = /^([A-Ga-g])([#b♯♭]{0,2})(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note name: ${name}`);
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = base[m[1].toUpperCase()];
  for (const ch of m[2]) pc += ch === '#' || ch === '♯' ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + pc;
}

export const n = parseSci;

/** Cents between a measured (fractional) MIDI value and a target note. */
export function centsOff(midiFloat: number, target: number) {
  return (midiFloat - target) * 100;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function inSaxRange(written: number) {
  return written >= SAX_LOW && written <= SAX_HIGH;
}

/** Interval names in Russian by semitone count (within an octave and a bit). */
export const INTERVAL_NAMES_RU: Record<number, string> = {
  0: 'прима',
  1: 'малая секунда',
  2: 'большая секунда',
  3: 'малая терция',
  4: 'большая терция',
  5: 'чистая кварта',
  6: 'тритон',
  7: 'чистая квинта',
  8: 'малая секста',
  9: 'большая секста',
  10: 'малая септима',
  11: 'большая септима',
  12: 'октава',
};
