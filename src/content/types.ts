// Course content types.
import type { BackingStyle } from '../audio/backing';
import type { Exercise, Tier } from '../practice/types';

export type IllustrationId =
  | 'breathing'
  | 'embouchure'
  | 'posture'
  | 'tonguing'
  | 'mouthpiece'
  | 'staff'
  | 'durations'
  | 'octave'
  | 'vibrato'
  | 'dynamics'
  | 'blues'
  | 'swing';

export type Demo =
  | { kind: 'note'; note: number; seconds?: number; vibrato?: boolean; detune?: number }
  | { kind: 'abc'; abc: string; bpm?: number; swing?: boolean; style?: BackingStyle; chords?: string; metronome?: boolean }
  | { kind: 'interval'; a: number; b: number; harmonic?: boolean }
  | { kind: 'chord'; notes: number[] }
  | { kind: 'backing'; style: BackingStyle; chords: string; bpm: number; bars: number };

export type TheoryBlock =
  | { type: 'text'; md: string }
  | { type: 'tip'; md: string; title?: string }
  | { type: 'warn'; md: string }
  | { type: 'illustration'; id: IllustrationId; caption?: string }
  | { type: 'abc'; abc: string; caption?: string; names?: boolean; fingerings?: boolean; bpm?: number }
  | { type: 'fingering'; notes: number[]; caption?: string }
  | { type: 'listen'; label: string; demo: Demo; caption?: string }
  | { type: 'compare'; caption?: string; items: { label: string; demo: Demo }[] }
  | { type: 'video'; query: string; title: string };

export type QuizQuestion =
  | { type: 'mcq'; q: string; options: string[]; answer: number; explain?: string; abc?: string; listen?: Demo }
  | { type: 'noteName'; notes: number[]; count: number }
  | { type: 'fingeringName'; notes: number[]; count: number }
  | { type: 'interval'; intervals: number[]; count: number }
  | { type: 'chordQuality'; qualities: ('major' | 'minor' | 'dom7' | 'dim')[]; count: number };

export interface Lesson {
  id: string;
  title: string;
  subtitle?: string;
  minutes?: number;
  tier: Tier;
  blocks: TheoryBlock[];
  exercises: Exercise[];
  quiz?: QuizQuestion[];
}

export interface Exam {
  title: string;
  description: string;
  exercises: Exercise[];
  quiz?: QuizQuestion[];
}

export interface Module {
  id: string;
  title: string;
  icon: string;
  description: string;
  lessons: Lesson[];
  exam: Exam;
}
