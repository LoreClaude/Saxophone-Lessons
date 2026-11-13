// Scales, chords and key signatures.
import { pitchClass } from './notes';

export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'majorBlues'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'chromatic'
  | 'bebopDominant';

export const SCALES: Record<ScaleType, { name: string; steps: number[] }> = {
  major: { name: 'мажор', steps: [0, 2, 4, 5, 7, 9, 11] },
  naturalMinor: { name: 'натуральный минор', steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonicMinor: { name: 'гармонический минор', steps: [0, 2, 3, 5, 7, 8, 11] },
  melodicMinor: { name: 'мелодический минор', steps: [0, 2, 3, 5, 7, 9, 11] },
  majorPentatonic: { name: 'мажорная пентатоника', steps: [0, 2, 4, 7, 9] },
  minorPentatonic: { name: 'минорная пентатоника', steps: [0, 3, 5, 7, 10] },
  blues: { name: 'блюзовая гамма', steps: [0, 3, 5, 6, 7, 10] },
  majorBlues: { name: 'мажорный блюз', steps: [0, 2, 3, 4, 7, 9] },
  dorian: { name: 'дорийский лад', steps: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian: { name: 'миксолидийский лад', steps: [0, 2, 4, 5, 7, 9, 10] },
  lydian: { name: 'лидийский лад', steps: [0, 2, 4, 6, 7, 9, 11] },
  phrygian: { name: 'фригийский лад', steps: [0, 1, 3, 5, 7, 8, 10] },
  chromatic: { name: 'хроматическая гамма', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  bebopDominant: { name: 'бибоп-доминантовая гамма', steps: [0, 2, 4, 5, 7, 9, 10, 11] },
};

/** Ascending scale notes from `root` (MIDI) covering `octaves` octaves (ending on the root). */
export function scaleNotes(root: number, type: ScaleType, octaves = 1): number[] {
  const steps = SCALES[type].steps;
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) for (const s of steps) out.push(root + 12 * o + s);
  out.push(root + 12 * octaves);
  return out;
}

/** Pitch-class set of a scale. */
export function scalePcs(rootPc: number, type: ScaleType): Set<number> {
  return new Set(SCALES[type].steps.map((s) => (rootPc + s) % 12));
}

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

const QUALITIES: [RegExp, number[], string][] = [
  [/^(maj9|M9|Δ9)$/, [0, 4, 7, 11, 14], 'maj9'],
  [/^(maj7|M7|Δ7|Δ|ma7)$/, [0, 4, 7, 11], 'maj7'],
  [/^(m9|-9|min9)$/, [0, 3, 7, 10, 14], 'm9'],
  [/^(m7b5|m7♭5|ø|ø7|-7b5)$/, [0, 3, 6, 10], 'm7b5'],
  [/^(m7|-7|min7)$/, [0, 3, 7, 10], 'm7'],
  [/^(m6|-6|min6)$/, [0, 3, 7, 9], 'm6'],
  [/^(mMaj7|m\(maj7\)|-Δ7)$/, [0, 3, 7, 11], 'mMaj7'],
  [/^(m|-|min)$/, [0, 3, 7], 'm'],
  [/^(dim7|o7|°7)$/, [0, 3, 6, 9], 'dim7'],
  [/^(dim|o|°)$/, [0, 3, 6], 'dim'],
  [/^(aug|\+)$/, [0, 4, 8], 'aug'],
  [/^(7sus4|7sus)$/, [0, 5, 7, 10], '7sus4'],
  [/^(sus4|sus)$/, [0, 5, 7], 'sus4'],
  [/^(7#9|7♯9)$/, [0, 4, 7, 10, 15], '7#9'],
  [/^(7b9|7♭9)$/, [0, 4, 7, 10, 13], '7b9'],
  [/^(13)$/, [0, 4, 7, 10, 14, 21], '13'],
  [/^(9)$/, [0, 4, 7, 10, 14], '9'],
  [/^(7)$/, [0, 4, 7, 10], '7'],
  [/^(6|6\/9|69)$/, [0, 4, 7, 9], '6'],
  [/^(maj|M|)$/, [0, 4, 7], ''],
];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface Chord {
  symbol: string;
  rootPc: number;
  bassPc: number;
  intervals: number[];
  quality: string;
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G])([#b♯♭]?)(.*?)(?:\/([A-G])([#b♯♭]?))?$/.exec(symbol.trim());
  if (!m) throw new Error(`Bad chord: ${symbol}`);
  const acc = (a: string) => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);
  const rootPc = (LETTER_PC[m[1]] + acc(m[2]) + 12) % 12;
  const rest = m[3] || '';
  let intervals = [0, 4, 7];
  let quality = '';
  for (const [re, iv, q] of QUALITIES) {
    if (re.test(rest)) {
      intervals = iv;
      quality = q;
      break;
    }
  }
  const bassPc = m[4] ? (LETTER_PC[m[4]] + acc(m[5]) + 12) % 12 : rootPc;
  return { symbol, rootPc, bassPc, intervals, quality };
}

export function chordPcs(c: Chord): Set<number> {
  return new Set(c.intervals.map((i) => (c.rootPc + i) % 12));
}

/** Transposes a chord symbol by `semi` semitones, preferring flats for flat results. */
export function transposeChordSymbol(symbol: string, semi: number, preferFlats = true): string {
  const c = parseChord(symbol);
  const m = /^([A-G][#b♯♭]?)(.*?)(?:\/([A-G][#b♯♭]?))?$/.exec(symbol.trim())!;
  const names = preferFlats
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const root = names[(c.rootPc + semi + 120) % 12];
  const bass = m[3] ? '/' + names[(c.bassPc + semi + 120) % 12] : '';
  return `${root}${m[2] || ''}${bass}`;
}

/** Splits a chord chart like "| C7 | F7 | C7 C7 |" into per-bar arrays. */
export function parseChordChart(chart: string): string[][] {
  return chart
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map((b) => b.split(/\s+/).filter(Boolean));
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export interface KeySig {
  abc: string; // ABC K: value, e.g. "G", "Bb", "Am"
  tonicPc: number;
  minor: boolean;
  /** Number of sharps (>0) or flats (<0). */
  accidentals: number;
  nameRu: string;
}

const MAJOR_KEYS: [string, number, number, string][] = [
  ['C', 0, 0, 'До мажор'],
  ['G', 7, 1, 'Соль мажор'],
  ['D', 2, 2, 'Ре мажор'],
  ['A', 9, 3, 'Ля мажор'],
  ['E', 4, 4, 'Ми мажор'],
  ['B', 11, 5, 'Си мажор'],
  ['F#', 6, 6, 'Фа-диез мажор'],
  ['F', 5, -1, 'Фа мажор'],
  ['Bb', 10, -2, 'Си-бемоль мажор'],
  ['Eb', 3, -3, 'Ми-бемоль мажор'],
  ['Ab', 8, -4, 'Ля-бемоль мажор'],
  ['Db', 1, -5, 'Ре-бемоль мажор'],
  ['Gb', 6, -6, 'Соль-бемоль мажор'],
];
const MINOR_KEYS: [string, number, number, string][] = [
  ['Am', 9, 0, 'Ля минор'],
  ['Em', 4, 1, 'Ми минор'],
  ['Bm', 11, 2, 'Си минор'],
  ['F#m', 6, 3, 'Фа-диез минор'],
  ['C#m', 1, 4, 'До-диез минор'],
  ['G#m', 8, 5, 'Соль-диез минор'],
  ['Dm', 2, -1, 'Ре минор'],
  ['Gm', 7, -2, 'Соль минор'],
  ['Cm', 0, -3, 'До минор'],
  ['Fm', 5, -4, 'Фа минор'],
  ['Bbm', 10, -5, 'Си-бемоль минор'],
  ['Ebm', 3, -6, 'Ми-бемоль минор'],
];

export function keySig(abc: string): KeySig {
  const all = [...MAJOR_KEYS.map((k) => [...k, false] as const), ...MINOR_KEYS.map((k) => [...k, true] as const)];
  const f = all.find((k) => k[0] === abc);
  if (!f) throw new Error(`Unknown key ${abc}`);
  return { abc: f[0], tonicPc: f[1], accidentals: f[2], nameRu: f[3], minor: f[4] };
}

/** Finds the major/minor key for a tonic pitch class (prefers fewer accidentals). */
export function keyFor(tonicPc: number, minor = false): KeySig {
  const list = minor ? MINOR_KEYS : MAJOR_KEYS;
  const cands = list.filter((k) => k[1] === pitchClass(tonicPc));
  cands.sort((a, b) => Math.abs(a[2]) - Math.abs(b[2]));
  return keySig(cands[0][0]);
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Letter → accidental (+1/-1/0) implied by the key signature. */
export function keyAccidentalMap(k: KeySig): Record<string, number> {
  const map: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (k.accidentals > 0) SHARP_ORDER.slice(0, k.accidentals).forEach((l) => (map[l] = 1));
  if (k.accidentals < 0) FLAT_ORDER.slice(0, -k.accidentals).forEach((l) => (map[l] = -1));
  return map;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Spells a MIDI note as letter + accidental + octave in the context of a key.
 * Notes belonging to the key use the key's letters; others use sharps in sharp
 * keys and flats in flat keys (C major prefers sax-friendly C♯ E♭ F♯ G♯ B♭).
 */
export function spell(m: number, k: KeySig): { letter: string; acc: number; octave: number } {
  const map = keyAccidentalMap(k);
  const pc = pitchClass(m);
  // Diatonic spelling in this key?
  for (const l of LETTERS) {
    if ((LETTER_PC[l] + map[l] + 12) % 12 === pc) {
      const raw = LETTER_PC[l] + map[l];
      const octave = Math.floor((m - raw) / 12) - 1;
      return { letter: l, acc: map[l], octave };
    }
  }
  let preferSharp = k.accidentals > 0;
  if (k.accidentals === 0) {
    // sax-friendly defaults
    preferSharp = pc === 1 || pc === 6 || pc === 8;
  }
  for (const l of LETTERS) {
    const want = preferSharp ? 1 : -1;
    if ((LETTER_PC[l] + want + 12) % 12 === pc) {
      const raw = LETTER_PC[l] + want;
      const octave = Math.floor((m - raw) / 12) - 1;
      return { letter: l, acc: want, octave };
    }
  }
  // natural (only reached for keys whose signature alters this letter)
  for (const l of LETTERS) {
    if (LETTER_PC[l] === pc) return { letter: l, acc: 0, octave: Math.floor(m / 12) - 1 };
  }
  throw new Error('unreachable');
}
