// Turns a stream of analysis frames into detected notes.
import type { Frame } from './dsp';

export interface DetectedNote {
  /** Start/end time (AudioContext seconds). */
  start: number;
  end: number;
  /** Concert MIDI (rounded semitone). */
  midi: number;
  /** Mean deviation from the rounded semitone in cents (stable part). */
  cents: number;
  /** Standard deviation of pitch in cents (stable part). */
  stdCents: number;
  /** Mean / peak level in dBFS. */
  db: number;
  peakDb: number;
  /** How the note began: after silence/dip (tongued) or straight from the previous note (slurred). */
  attack: 'tongued' | 'slurred';
  clarity: number;
  /** Frames of the note (references, not copies). */
  frames: Frame[];
}

export interface SegmentOptions {
  /** Frames a new semitone must persist before switching notes. */
  changeFrames?: number;
  /** Unvoiced frames that end a note. */
  gapFrames?: number;
  /** Minimum note length in seconds. */
  minNote?: number;
  /** dB drop (relative to the note level) treated as a re-articulation. */
  dipDb?: number;
}

export function segmentNotes(frames: Frame[], opts: SegmentOptions = {}): DetectedNote[] {
  const changeFrames = opts.changeFrames ?? 3;
  const gapFrames = opts.gapFrames ?? 2;
  const minNote = opts.minNote ?? 0.045;
  const dipDb = opts.dipDb ?? 9;

  const raw: { frames: Frame[]; attack: 'tongued' | 'slurred' }[] = [];
  let cur: Frame[] | null = null;
  let curSemi = 0;
  let curAttack: 'tongued' | 'slurred' = 'tongued';
  let pending: Frame[] = [];
  let pendingSemi = 0;
  let gap = 0;
  let levelRef = -100; // running level of the current note

  const close = () => {
    if (cur && cur.length) raw.push({ frames: cur, attack: curAttack });
    cur = null;
    pending = [];
  };

  for (const f of frames) {
    if (!f.voiced) {
      gap++;
      if (cur && gap >= gapFrames) {
        close();
        curAttack = 'tongued';
      }
      continue;
    }
    const semi = Math.round(f.midi);
    if (!cur) {
      cur = [f];
      curSemi = semi;
      levelRef = f.db;
      if (gap === 0 && raw.length) curAttack = 'slurred';
      gap = 0;
      continue;
    }
    gap = 0;
    // re-articulation on the same pitch: level dip followed by recovery
    if (semi === curSemi && cur.length > 4 && f.db < levelRef - dipDb) {
      // mark dip; split when the level recovers
      (f as any)._dip = true;
    }
    const prev = cur[cur.length - 1] as any;
    if (semi === curSemi && prev?._dip && f.db >= levelRef - 3) {
      // split at the dip
      const dipIdx = cur.findIndex((x: any) => x._dip);
      const before = cur.slice(0, dipIdx);
      const after = cur.slice(dipIdx);
      if (before.length) raw.push({ frames: before, attack: curAttack });
      cur = after.filter((x: any) => !x._dip);
      cur.push(f);
      curAttack = 'tongued';
      levelRef = f.db;
      continue;
    }

    if (semi !== curSemi) {
      if (pending.length && semi === pendingSemi) pending.push(f);
      else {
        pending = [f];
        pendingSemi = semi;
      }
      if (pending.length >= changeFrames) {
        // switch note (legato change of pitch)
        const pend = pending;
        close();
        cur = [...pend];
        curSemi = pendingSemi;
        curAttack = 'slurred';
        levelRef = Math.max(...pend.map((x) => x.db));
      }
      continue;
    }
    if (pending.length) {
      // short glitch: absorb it
      cur.push(...pending);
      pending = [];
    }
    cur.push(f);
    // slowly follow the level (attack peak → sustain)
    levelRef = Math.max(levelRef * 0.98 + f.db * 0.02, f.db > levelRef ? f.db : levelRef - 0.05);
  }
  close();

  const out: DetectedNote[] = [];
  for (const seg of raw) {
    const fr = seg.frames;
    if (!fr.length) continue;
    const start = fr[0].t;
    const end = fr[fr.length - 1].t + hopOf(frames);
    if (end - start < minNote) continue;
    const semis = fr.map((x) => Math.round(x.midi));
    const midi = mode(semis);
    // stable part: skip ~30 ms attack and 20 ms release when long enough
    const skipA = fr.length > 8 ? 3 : 0;
    const skipR = fr.length > 8 ? 2 : 0;
    const stable = fr.slice(skipA, fr.length - skipR).filter((x) => Math.round(x.midi) === midi);
    const use = stable.length ? stable : fr;
    const cents = use.map((x) => (x.midi - midi) * 100);
    const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
    const std = Math.sqrt(cents.reduce((a, b) => a + (b - mean) * (b - mean), 0) / cents.length);
    const dbs = fr.map((x) => x.db);
    out.push({
      start,
      end,
      midi,
      cents: mean,
      stdCents: std,
      db: dbs.reduce((a, b) => a + b, 0) / dbs.length,
      peakDb: Math.max(...dbs),
      attack: seg.attack,
      clarity: fr.reduce((a, b) => a + b.clarity, 0) / fr.length,
      frames: fr,
    });
  }
  // merge accidental splits: same pitch, slurred, touching
  const merged: DetectedNote[] = [];
  for (const nt of out) {
    const last = merged[merged.length - 1];
    if (last && last.midi === nt.midi && nt.attack === 'slurred' && nt.start - last.end < 0.03) {
      last.end = nt.end;
      last.frames = [...last.frames, ...nt.frames];
      continue;
    }
    merged.push(nt);
  }
  return merged;
}

function hopOf(frames: Frame[]) {
  if (frames.length > 1) return frames[1].t - frames[0].t;
  return 0.01;
}

function mode(arr: number[]) {
  const c = new Map<number, number>();
  for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1);
  let best = arr[0];
  let bc = 0;
  for (const [k, v] of c) if (v > bc) ((best = k), (bc = v));
  return best;
}

/** Median of numbers. */
export function median(a: number[]) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
