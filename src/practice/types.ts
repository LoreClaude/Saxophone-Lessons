// Exercise and evaluation types shared by content, runners and evaluators.
import type { BackingStyle } from '../audio/backing';
import type { ScaleType } from '../music/theory';

export type Tier = 1 | 2 | 3 | 4;
export type Strictness = 'easy' | 'normal' | 'hard';

export interface Tolerances {
  /** Intonation (cents) for "good" and "perfect". */
  centsGood: number;
  centsPerfect: number;
  /** Timing deviation (seconds) for "good" and "perfect". */
  timingGood: number;
  timingPerfect: number;
  /** Score needed to pass an exercise. */
  passScore: number;
  /** How long the right note must be held in wait mode (ms). */
  holdMs: number;
}

export const TIER_NAMES: Record<Tier, string> = {
  1: 'Новичок',
  2: 'Ученик',
  3: 'Музыкант',
  4: 'Мастер',
};

const BASE: Record<Tier, Tolerances> = {
  1: { centsGood: 40, centsPerfect: 20, timingGood: 0.16, timingPerfect: 0.07, passScore: 65, holdMs: 260 },
  2: { centsGood: 30, centsPerfect: 15, timingGood: 0.12, timingPerfect: 0.055, passScore: 70, holdMs: 230 },
  3: { centsGood: 25, centsPerfect: 12, timingGood: 0.1, timingPerfect: 0.045, passScore: 75, holdMs: 200 },
  4: { centsGood: 20, centsPerfect: 10, timingGood: 0.08, timingPerfect: 0.035, passScore: 80, holdMs: 180 },
};

export function tolerances(tier: Tier, strictness: Strictness = 'normal'): Tolerances {
  const b = BASE[tier];
  const k = strictness === 'easy' ? 1.4 : strictness === 'hard' ? 0.75 : 1;
  const dp = strictness === 'easy' ? -5 : strictness === 'hard' ? 5 : 0;
  return {
    centsGood: b.centsGood * k,
    centsPerfect: b.centsPerfect * k,
    timingGood: b.timingGood * k,
    timingPerfect: b.timingPerfect * k,
    passScore: b.passScore + dp,
    holdMs: b.holdMs,
  };
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

interface ExBase {
  id: string;
  title: string;
  /** Short instruction shown above the exercise (markdown allowed). */
  goal: string;
  tips?: string[];
  tier?: Tier;
  passScore?: number;
  xp?: number;
  /** Optional exercises do not block progression. */
  optional?: boolean;
}

export interface NotesExercise extends ExBase {
  kind: 'notes';
  /** Written MIDI notes to ask for. */
  pool: number[];
  count: number;
  /** How the note is shown. */
  show: 'staff' | 'name' | 'fingering' | 'mixed';
  /** Ask notes in order instead of randomly. */
  ordered?: boolean;
}

export interface LongToneExercise extends ExBase {
  kind: 'longtone';
  notes: number[];
  seconds: number;
}

export interface BreathExercise extends ExBase {
  kind: 'breath';
  seconds: number;
}

export interface MouthpieceExercise extends ExBase {
  kind: 'mouthpiece';
  part: 'mouthpiece' | 'neck';
  seconds: number;
}

export interface SequenceExercise extends ExBase {
  kind: 'sequence';
  abc: string;
  bpm?: number;
  /** Allowed modes; first is the default. */
  modes?: ('tempo' | 'wait')[];
  metronome?: boolean;
  style?: BackingStyle;
  /** Chord chart in written key: "| G7 | C7 | ..." */
  chords?: string;
  countInBars?: number;
  check?: { articulation?: boolean; dynamics?: boolean };
  /** Play the melody with swung eighths (demo + evaluation). */
  swing?: boolean;
  /** Show note names under the notes. */
  showNames?: boolean;
}

export interface EchoExercise extends ExBase {
  kind: 'echo';
  /** Full ABC tunes, one per phrase. */
  phrases: string[];
  bpm: number;
}

export interface DynamicsExercise extends ExBase {
  kind: 'dynamics';
  note: number;
  shape: 'cresc' | 'dim' | 'messa';
  seconds: number;
}

export interface VibratoExercise extends ExBase {
  kind: 'vibrato';
  note: number;
  seconds: number;
  rate?: [number, number];
  depth?: [number, number];
}

export interface ImprovExercise extends ExBase {
  kind: 'improv';
  style: BackingStyle;
  chords: string;
  bpm: number;
  /** Number of bars to improvise (chart loops if shorter). */
  bars: number;
  /** Written root pitch class and scale type. */
  scale: { root: number; type: ScaleType };
  focus?: string;
}

export type Exercise =
  | NotesExercise
  | LongToneExercise
  | BreathExercise
  | MouthpieceExercise
  | SequenceExercise
  | EchoExercise
  | DynamicsExercise
  | VibratoExercise
  | ImprovExercise;

export type ExerciseKind = Exercise['kind'];

export const KIND_NAMES: Record<ExerciseKind, string> = {
  notes: 'Найди ноту',
  longtone: 'Долгие ноты',
  breath: 'Дыхание',
  mouthpiece: 'Мундштук',
  sequence: 'Игра по нотам',
  echo: 'Повтори за мной',
  dynamics: 'Динамика',
  vibrato: 'Вибрато',
  improv: 'Импровизация',
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type CriterionId =
  | 'pitch'
  | 'intonation'
  | 'rhythm'
  | 'duration'
  | 'stability'
  | 'loudness'
  | 'dynamics'
  | 'articulation'
  | 'tone'
  | 'vibratoRate'
  | 'vibratoDepth'
  | 'vibratoEven'
  | 'breath'
  | 'reaction'
  | 'ear'
  | 'scale'
  | 'chordTones'
  | 'space'
  | 'variety'
  | 'zone';

export interface Criterion {
  id: CriterionId;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export type Judgment = 'perfect' | 'good' | 'ok' | 'wrong' | 'miss';

export interface NoteResult {
  i: number;
  expected: number;
  played?: number;
  cents?: number;
  timing?: number;
  judgment: Judgment;
  /** Extra info, e.g. squeak. */
  flag?: 'squeak' | 'merged';
}

export interface EvalResult {
  score: number;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  criteria: Criterion[];
  notes?: NoteResult[];
  summary: string;
  tips: string[];
  metrics: Record<string, number | string | boolean>;
  points?: number;
  maxCombo?: number;
  durationSec: number;
}

export function starsFor(score: number, pass: number): 0 | 1 | 2 | 3 {
  if (score < pass) return 0;
  if (score >= 95) return 3;
  if (score >= Math.max(pass + 10, 85)) return 2;
  return 1;
}
