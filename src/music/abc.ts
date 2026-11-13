// ABC notation helpers: building ABC from note lists and turning ABC into a
// timed score (expected notes) using abcjs' own parser so that playback,
// rendering and evaluation always agree.
import abcjs from 'abcjs';
import { keySig, spell, keyAccidentalMap, type KeySig } from './theory';

export interface ScoreNote {
  /** Index in performance order. */
  i: number;
  /** Written MIDI pitch (alto part). */
  midi: number;
  /** Start in beats (beat 0 = first downbeat after the count-in). */
  beat: number;
  /** Duration in beats (ties merged). */
  beats: number;
  startChar: number;
  /** startChar of the tied continuation notes (for highlighting). */
  tieChars: number[];
  staccato: boolean;
  accent: boolean;
  /** Played legato from the previous note (under a slur, no tonguing). */
  slurred: boolean;
  /** abcjs MIDI volume (0..127) – reflects dynamics marks. */
  volume: number;
  /** Dynamic mark starting at this note (p, mf, f …). */
  dynamic?: string;
  cresc?: 'start' | 'end';
  dim?: 'start' | 'end';
}

export interface Score {
  abc: string;
  notes: ScoreNote[];
  /** Beat unit as a fraction of a whole note (1/4 = quarter). */
  beatUnit: number;
  bpm: number;
  beatsPerBar: number;
  meter: [number, number];
  totalBeats: number;
  key: string;
  title: string;
  /** Beats of pickup shift applied (0 if none). */
  pickupShift: number;
}

const DYNAMICS = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sfz']);

export function parseScore(abc: string, opts: { bpm?: number } = {}): Score {
  const tunes = (abcjs as any).parseOnly(abc);
  if (!tunes.length) throw new Error('ABC parse failed');
  const t = tunes[0];
  const beatUnit: number = t.getBeatLength() || 0.25;
  const meterFrac = t.getMeterFraction() || { num: 4, den: 4 };
  const barLen: number = t.getBarLength() || 1;
  const beatsPerBar = Math.max(1, Math.round((barLen / beatUnit) * 1000) / 1000);
  const bpm = opts.bpm ?? (t.getBpm() || 80);
  const pickup: number = t.getPickupLength() || 0;
  const pickupShift = pickup > 0 ? (barLen - pickup) / beatUnit : 0;

  // Walk parsed elements once to collect per-note articulation info.
  interface VisualInfo {
    staccato: boolean;
    accent: boolean;
    slurred: boolean;
    dynamic?: string;
    cresc?: 'start' | 'end';
    dim?: 'start' | 'end';
    endTie: boolean;
  }
  const visual = new Map<number, VisualInfo>();
  const visualOrder: number[] = [];
  let slurDepth = 0;
  for (const line of t.lines) {
    const staff = line.staff?.[0];
    if (!staff) continue;
    for (const el of staff.voices[0] || []) {
      if (el.el_type !== 'note' || el.rest || !el.pitches?.length) continue;
      const p = el.pitches[0];
      const deco: string[] = el.decoration || [];
      const info: VisualInfo = {
        staccato: deco.includes('staccato'),
        accent: deco.includes('accent') || deco.includes('>'),
        slurred: slurDepth > 0,
        endTie: Boolean(p.endTie),
      };
      for (const d of deco) {
        if (DYNAMICS.has(d)) info.dynamic = d;
        if (d === 'crescendo(' || d === '<(') info.cresc = 'start';
        if (d === 'crescendo)' || d === '<)') info.cresc = 'end';
        if (d === 'diminuendo(' || d === '>(') info.dim = 'start';
        if (d === 'diminuendo)' || d === '>)') info.dim = 'end';
      }
      if (p.startSlur) slurDepth += p.startSlur.length;
      if (p.endSlur) slurDepth = Math.max(0, slurDepth - p.endSlur.length);
      visual.set(el.startChar, info);
      visualOrder.push(el.startChar);
    }
  }

  const audio = t.setUpAudio({});
  const track = (audio.tracks?.[0] || []).filter((e: any) => e.cmd === 'note');
  const notes: ScoreNote[] = track.map((e: any, i: number) => {
    const info = visual.get(e.startChar);
    // tie continuation characters following this note in visual order
    const tieChars: number[] = [];
    const vi = visualOrder.indexOf(e.startChar);
    if (vi >= 0) {
      for (let k = vi + 1; k < visualOrder.length; k++) {
        const nxt = visual.get(visualOrder[k]);
        if (nxt?.endTie) tieChars.push(visualOrder[k]);
        else break;
      }
    }
    return {
      i,
      midi: e.pitch,
      beat: round(e.start / beatUnit + pickupShift),
      beats: round(e.duration / beatUnit),
      startChar: e.startChar,
      tieChars,
      staccato: info?.staccato ?? e.endType === 'staccato',
      accent: info?.accent ?? false,
      slurred: info?.slurred ?? false,
      volume: e.volume,
      dynamic: info?.dynamic,
      cresc: info?.cresc,
      dim: info?.dim,
    } satisfies ScoreNote;
  });
  const last = notes[notes.length - 1];
  const rawTotal = (t.getTotalBeats?.() as number) || 0;
  const totalBeats = Math.max(last ? last.beat + last.beats : 0, Math.ceil(rawTotal) || 0);
  const titleMatch = /^T:(.*)$/m.exec(abc);
  const keyMatch = /^K:\s*(\S+)/m.exec(abc);
  return {
    abc,
    notes,
    beatUnit,
    bpm,
    beatsPerBar,
    meter: [meterFrac.num, meterFrac.den],
    totalBeats: Math.ceil(totalBeats / beatsPerBar) * beatsPerBar,
    key: keyMatch ? keyMatch[1] : 'C',
    title: titleMatch ? titleMatch[1].trim() : '',
    pickupShift,
  };
}

const round = (v: number) => Math.round(v * 10000) / 10000;

export const beatsToSeconds = (beats: number, bpm: number) => (beats * 60) / bpm;

// ---------------------------------------------------------------------------
// Building ABC
// ---------------------------------------------------------------------------

export interface BuildNote {
  /** Written MIDI or null for a rest. */
  midi: number | null;
  /** Duration in quarter-note beats. */
  beats: number;
  staccato?: boolean;
  accent?: boolean;
  slurStart?: boolean;
  slurEnd?: boolean;
  dynamic?: string;
  decorations?: string[];
  chord?: string;
}

export interface BuildOptions {
  key?: string; // ABC key, e.g. "C", "G", "Bb", "Am"
  meter?: [number, number];
  bpm?: number;
  title?: string;
  barsPerLine?: number;
  /** Extra header lines, e.g. "%%staffsep 80". */
  extraHeader?: string[];
}

function frac(lenInEighths: number): string {
  // Convert to a reduced fraction of the L:1/8 unit
  const q = 48;
  let p = Math.round(lenInEighths * q);
  let d = q;
  const g = gcd(p, d);
  p /= g;
  d /= g;
  if (d === 1) return p === 1 ? '' : String(p);
  return `${p === 1 ? '' : p}/${d}`;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function pitchToAbc(m: number, key: KeySig, measureAcc: Map<string, number>): string {
  const s = spell(m, key);
  const keyMap = keyAccidentalMap(key);
  const id = `${s.letter}${s.octave}`;
  const current = measureAcc.has(id) ? measureAcc.get(id)! : keyMap[s.letter];
  let accStr = '';
  if (current !== s.acc) {
    accStr = s.acc === 1 ? '^' : s.acc === -1 ? '_' : s.acc === 2 ? '^^' : s.acc === -2 ? '__' : '=';
    measureAcc.set(id, s.acc);
  }
  let letter = s.letter;
  let oct = '';
  if (s.octave >= 5) {
    letter = letter.toLowerCase();
    oct = "'".repeat(s.octave - 5);
  } else {
    oct = ','.repeat(4 - s.octave);
  }
  return `${accStr}${letter}${oct}`;
}

/** Builds an ABC tune from a list of notes (durations in quarter beats). */
export function buildAbc(notes: BuildNote[], opts: BuildOptions = {}): string {
  const key = keySig(opts.key ?? 'C');
  const [mn, md] = opts.meter ?? [4, 4];
  const barQuarter = (mn * 4) / md; // bar length in quarter notes
  const barsPerLine = opts.barsPerLine ?? 4;
  const header = [
    'X:1',
    opts.title ? `T:${opts.title}` : null,
    `M:${mn}/${md}`,
    'L:1/8',
    `Q:1/4=${opts.bpm ?? 80}`,
    ...(opts.extraHeader ?? []),
    `K:${key.abc}`,
  ].filter(Boolean) as string[];

  let body = '';
  let pos = 0; // quarter beats within the bar
  let bars = 0;
  let measureAcc = new Map<string, number>();
  const emitBar = () => {
    bars++;
    measureAcc = new Map();
    body += bars % barsPerLine === 0 ? ' |\n' : ' | ';
  };
  for (const nt of notes) {
    let remaining = nt.beats;
    let first = true;
    while (remaining > 1e-6) {
      const space = barQuarter - pos;
      const part = Math.min(space, remaining);
      let tok = '';
      if (first) {
        if (nt.chord) tok += `"${nt.chord}"`;
        if (nt.dynamic) tok += `!${nt.dynamic}!`;
        for (const d of nt.decorations ?? []) tok += `!${d}!`;
        if (nt.accent) tok += 'L';
        if (nt.staccato) tok += '.';
        if (nt.slurStart) tok += '(';
      }
      if (nt.midi === null) tok += 'z';
      else tok += pitchToAbc(nt.midi, key, measureAcc);
      tok += frac(part * 2);
      remaining -= part;
      if (nt.midi !== null && remaining > 1e-6) tok += '-';
      if (remaining <= 1e-6 && nt.slurEnd) tok += ')';
      body += tok + ' ';
      first = false;
      pos += part;
      if (pos >= barQuarter - 1e-6) {
        pos = 0;
        emitBar();
      }
    }
  }
  if (pos > 1e-6) {
    // pad the last bar with a rest
    body += `z${frac((barQuarter - pos) * 2)} `;
    emitBar();
  }
  body = body.replace(/ \| (\n?)$/, ' |]$1').replace(/ \|\n$/, ' |]\n');
  if (!/\|\]\s*$/.test(body)) body = body.replace(/\|\s*$/, '|]');
  return `${header.join('\n')}\n${body.trim()}\n`;
}

/** Simple helper: equal-length notes. */
export function notesToAbc(midis: (number | null)[], beatsEach: number, opts: BuildOptions = {}) {
  return buildAbc(
    midis.map((m) => ({ midi: m, beats: beatsEach })),
    opts,
  );
}
