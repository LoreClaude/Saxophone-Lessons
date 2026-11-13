// IndexedDB (Dexie): attempt history, recordings, user content, chat, diary.
import Dexie, { type EntityTable } from 'dexie';
import type { Criterion, EvalResult } from '../practice/types';

export interface AttemptRow {
  id?: number;
  date: number;
  day: string;
  lessonId: string;
  exerciseId: string;
  kind: string;
  title: string;
  mode?: string;
  score: number;
  passed: boolean;
  stars: number;
  criteria: Criterion[];
  metrics: EvalResult['metrics'];
  durationSec: number;
  recordingId?: number;
  aiComment?: string;
}

export interface RecordingRow {
  id?: number;
  date: number;
  attemptId?: number;
  blob: Blob;
  sampleRate: number;
  seconds: number;
  title: string;
}

export interface PieceRow {
  id?: number;
  title: string;
  abc: string;
  bpm: number;
  createdAt: number;
  source: string;
  style?: string;
  chords?: string;
}

export interface UserLessonRow {
  id?: number;
  title: string;
  text: string;
  exercises: unknown[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRow {
  id?: number;
  ts: number;
  role: 'user' | 'assistant';
  content: string;
}

export interface DiaryRow {
  day: string;
  note: string;
  manualMinutes: number;
}

class SaxDB extends Dexie {
  attempts!: EntityTable<AttemptRow, 'id'>;
  recordings!: EntityTable<RecordingRow, 'id'>;
  pieces!: EntityTable<PieceRow, 'id'>;
  userLessons!: EntityTable<UserLessonRow, 'id'>;
  chat!: EntityTable<ChatRow, 'id'>;
  diary!: EntityTable<DiaryRow, 'day'>;

  constructor() {
    super('saxophonia');
    this.version(1).stores({
      attempts: '++id, date, day, lessonId, exerciseId, kind',
      recordings: '++id, date, attemptId',
      pieces: '++id, createdAt',
      userLessons: '++id, updatedAt',
      chat: '++id, ts',
      diary: 'day',
    });
  }
}

export const db = new SaxDB();

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
