// Learning progress, XP, streaks, quests, achievements and statistics.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EvalResult, ExerciseKind, CriterionId } from '../practice/types';
import { DEFAULT_XP, levelFromXp, XP_EXAM, XP_LESSON, XP_QUIZ } from '../game/levels';
import { questsForDay, QUEST_BONUS_XP, type Quest } from '../game/quests';
import { ACH_BY_ID } from '../game/achievements';
import { todayKey } from './db';

export type SkillId = 'notes' | 'intonation' | 'rhythm' | 'tone' | 'dynamics' | 'articulation' | 'ear' | 'improv' | 'reading' | 'breath';

export const SKILL_NAMES: Record<SkillId, string> = {
  notes: 'Точность нот',
  intonation: 'Интонация',
  rhythm: 'Ритм',
  tone: 'Звук',
  dynamics: 'Динамика',
  articulation: 'Артикуляция',
  ear: 'Слух',
  improv: 'Импровизация',
  reading: 'Чтение нот',
  breath: 'Дыхание',
};

const CRITERION_SKILL: Partial<Record<CriterionId, SkillId>> = {
  pitch: 'notes',
  intonation: 'intonation',
  rhythm: 'rhythm',
  duration: 'tone',
  stability: 'tone',
  loudness: 'tone',
  tone: 'tone',
  zone: 'tone',
  vibratoRate: 'tone',
  vibratoDepth: 'tone',
  vibratoEven: 'tone',
  dynamics: 'dynamics',
  articulation: 'articulation',
  ear: 'ear',
  scale: 'improv',
  chordTones: 'improv',
  space: 'improv',
  variety: 'improv',
  breath: 'breath',
  reaction: 'reading',
};

export interface ExerciseProgress {
  best: number;
  stars: number;
  attempts: number;
  passed: boolean;
  lastAt: number;
}

export interface DayStats {
  seconds: number;
  xp: number;
  attempts: number;
}

export interface NoteStat {
  n: number;
  cents: number; // EMA of signed cents
  abs: number; // EMA of |cents|
}

export interface Records {
  longestToneSec: number;
  longestBreathSec: number;
  maxCombo: number;
  bestImprov: number;
  fastestBpm: number;
  totalNotes: number;
}

export interface ProgressState {
  xp: number;
  exercises: Record<string, ExerciseProgress>;
  lessons: Record<string, { completed: boolean; quizBest: number; completedAt?: number }>;
  exams: Record<string, { passed: boolean; best: number }>;
  achievements: Record<string, number>;
  streak: { current: number; best: number; lastDay: string };
  days: Record<string, DayStats>;
  quests: { day: string; items: Quest[]; bonusClaimed: boolean };
  noteStats: Record<number, NoteStat>;
  skills: Partial<Record<SkillId, number>>;
  records: Records;
  totals: { attempts: number; seconds: number; warmups: number };
}

export interface AttemptOutcome {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  newAchievements: string[];
  questsDone: Quest[];
  firstPass: boolean;
  newBest: boolean;
}

const INITIAL: ProgressState = {
  xp: 0,
  exercises: {},
  lessons: {},
  exams: {},
  achievements: {},
  streak: { current: 0, best: 0, lastDay: '' },
  days: {},
  quests: { day: '', items: [], bonusClaimed: false },
  noteStats: {},
  skills: {},
  records: { longestToneSec: 0, longestBreathSec: 0, maxCombo: 0, bestImprov: 0, fastestBpm: 0, totalNotes: 0 },
  totals: { attempts: 0, seconds: 0, warmups: 0 },
};

interface Actions {
  ensureToday: (dailyGoal: number) => void;
  recordAttempt: (a: { exerciseKey: string; kind: ExerciseKind; result: EvalResult; xpBase?: number; mode?: string }) => AttemptOutcome;
  addPracticeSeconds: (sec: number) => string[];
  completeLesson: (lessonId: string) => AttemptOutcome | null;
  recordQuiz: (lessonId: string, correct: number, total: number) => AttemptOutcome;
  recordExam: (moduleId: string, score: number, passed: boolean) => AttemptOutcome;
  recordWarmup: () => AttemptOutcome;
  unlock: (id: string) => boolean;
  questEvent: (kind: Quest['kind'], value?: number) => Quest[];
  importState: (s: ProgressState) => void;
  reset: () => void;
}

const yesterdayOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayKey(dt);
};

const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000);
};

export const useProgress = create<ProgressState & Actions>()(
  persist(
    (set, get) => {
      /** Adds XP and returns achievements unlocked by level-ups. */
      const addXp = (s: ProgressState, amount: number) => {
        s.xp += amount;
        const day = todayKey();
        s.days[day] = s.days[day] ?? { seconds: 0, xp: 0, attempts: 0 };
        s.days[day].xp += amount;
      };

      const unlockInto = (s: ProgressState, id: string, list: string[]) => {
        if (s.achievements[id] || !ACH_BY_ID[id]) return;
        s.achievements[id] = Date.now();
        list.push(id);
        addXp(s, ACH_BY_ID[id].xp);
      };

      const levelAchievements = (s: ProgressState, list: string[]) => {
        const lvl = levelFromXp(s.xp).level;
        if (lvl >= 5) unlockInto(s, 'level_5', list);
        if (lvl >= 10) unlockInto(s, 'level_10', list);
        if (lvl >= 20) unlockInto(s, 'level_20', list);
      };

      const touchStreak = (s: ProgressState, list: string[]) => {
        const day = todayKey();
        if (s.streak.lastDay === day) return;
        if (s.streak.lastDay && daysBetween(s.streak.lastDay, day) >= 7) unlockInto(s, 'comeback', list);
        s.streak.current = s.streak.lastDay === yesterdayOf(day) ? s.streak.current + 1 : 1;
        s.streak.best = Math.max(s.streak.best, s.streak.current);
        s.streak.lastDay = day;
        if (s.streak.current >= 3) unlockInto(s, 'streak_3', list);
        if (s.streak.current >= 7) unlockInto(s, 'streak_7', list);
        if (s.streak.current >= 30) unlockInto(s, 'streak_30', list);
      };

      const progressQuest = (s: ProgressState, kind: Quest['kind'], value: number, mode: 'add' | 'max', done: Quest[], list: string[]) => {
        for (const q of s.quests.items) {
          if (q.kind !== kind || q.done) continue;
          q.progress = mode === 'add' ? q.progress + value : Math.max(q.progress, value);
          if (q.progress >= q.target) {
            q.progress = q.target;
            q.done = true;
            addXp(s, q.xp);
            done.push({ ...q });
          }
        }
        if (!s.quests.bonusClaimed && s.quests.items.length && s.quests.items.every((q) => q.done)) {
          s.quests.bonusClaimed = true;
          addXp(s, QUEST_BONUS_XP);
          unlockInto(s, 'quests_all', list);
        }
      };

      const clone = (): ProgressState => JSON.parse(JSON.stringify(stripActions(get())));

      return {
        ...INITIAL,

        ensureToday: (dailyGoal) => {
          const day = todayKey();
          if (get().quests.day !== day) set({ quests: { day, items: questsForDay(day, dailyGoal), bonusClaimed: false } });
        },

        recordAttempt: ({ exerciseKey, kind, result, xpBase, mode }) => {
          const s = clone();
          const levelBefore = levelFromXp(s.xp).level;
          const ach: string[] = [];
          const questsDone: Quest[] = [];
          const prev = s.exercises[exerciseKey];
          const firstPass = result.passed && !prev?.passed;
          const newBest = Boolean(prev && result.score >= prev.best + 5);
          let xp = Math.round((xpBase ?? DEFAULT_XP[kind]) * (result.score / 100));
          if (firstPass) xp += 25;
          if (newBest && prev?.passed) xp += 10;
          if (result.stars === 3 && (prev?.stars ?? 0) < 3) xp += 30;
          s.exercises[exerciseKey] = {
            best: Math.max(prev?.best ?? 0, result.score),
            stars: Math.max(prev?.stars ?? 0, result.stars),
            attempts: (prev?.attempts ?? 0) + 1,
            passed: Boolean(prev?.passed || result.passed),
            lastAt: Date.now(),
          };
          addXp(s, xp);
          const day = todayKey();
          s.days[day].attempts += 1;
          s.totals.attempts += 1;
          touchStreak(s, ach);

          // skills EMA
          for (const c of result.criteria) {
            const sk = CRITERION_SKILL[c.id];
            if (!sk) continue;
            const old = s.skills[sk];
            s.skills[sk] = old === undefined ? c.score : Math.round(old * 0.8 + c.score * 0.2);
          }
          // per-note intonation statistics
          for (const nr of result.notes ?? []) {
            if (nr.cents === undefined || nr.played !== nr.expected) continue;
            const st = s.noteStats[nr.expected] ?? { n: 0, cents: 0, abs: 0 };
            const a = st.n < 5 ? 1 / (st.n + 1) : 0.2;
            st.cents = st.cents * (1 - a) + nr.cents * a;
            st.abs = st.abs * (1 - a) + Math.abs(nr.cents) * a;
            st.n += 1;
            s.noteStats[nr.expected] = st;
          }
          // records
          const m = result.metrics;
          const held = Number(m.heldSec ?? 0);
          if (kind === 'longtone' && held > s.records.longestToneSec) s.records.longestToneSec = held;
          if (kind === 'breath' && Number(m.exhaleSec ?? 0) > s.records.longestBreathSec) s.records.longestBreathSec = Number(m.exhaleSec);
          if ((result.maxCombo ?? 0) > s.records.maxCombo) s.records.maxCombo = result.maxCombo ?? 0;
          if (kind === 'improv') s.records.bestImprov = Math.max(s.records.bestImprov, result.score);
          if (kind === 'sequence' && result.passed && Number(m.bpm ?? 0) > s.records.fastestBpm) s.records.fastestBpm = Number(m.bpm);
          s.records.totalNotes += Number(m.correct ?? m.notes ?? 0) || 0;

          // achievements
          unlockInto(s, 'first_sound', ach);
          if (result.passed) unlockInto(s, 'first_pass', ach);
          if (result.stars === 3) unlockInto(s, 'three_stars', ach);
          const combo = result.maxCombo ?? 0;
          if (combo >= 10) unlockInto(s, 'combo_10', ach);
          if (combo >= 25) unlockInto(s, 'combo_25', ach);
          if (combo >= 50) unlockInto(s, 'combo_50', ach);
          if (kind === 'longtone' && held >= 10) unlockInto(s, 'long_10', ach);
          if (kind === 'longtone' && held >= 20) unlockInto(s, 'long_20', ach);
          if (kind === 'breath' && Number(m.exhaleSec ?? 0) >= 30) unlockInto(s, 'breath_30', ach);
          if (s.totals.attempts >= 100) unlockInto(s, 'attempts_100', ach);
          const hour = new Date().getHours();
          if (hour >= 23) unlockInto(s, 'night_owl', ach);
          if (hour < 8 && hour >= 4) unlockInto(s, 'early_bird', ach);
          const inton = result.criteria.find((c) => c.id === 'intonation');
          if (kind === 'sequence' && inton && inton.score >= 100 && result.passed) unlockInto(s, 'pure_tone', ach);
          if (kind === 'improv') unlockInto(s, 'first_improv', ach);
          if (kind === 'improv' && result.score >= 85) unlockInto(s, 'improviser', ach);
          if (kind === 'vibrato' && result.passed) unlockInto(s, 'vibrato', ach);
          if (kind === 'echo' && result.score >= 100) unlockInto(s, 'golden_ear', ach);

          // quests
          progressQuest(s, 'attempts', 1, 'add', questsDone, ach);
          if (result.stars === 3) progressQuest(s, 'stars3', 1, 'add', questsDone, ach);
          if (combo) progressQuest(s, 'combo', combo, 'max', questsDone, ach);
          if (kind === 'longtone') progressQuest(s, 'longtone', held, 'max', questsDone, ach);
          if (result.score >= 90) progressQuest(s, 'score90', 1, 'add', questsDone, ach);
          if (inton && inton.score >= 85) progressQuest(s, 'intonation', 1, 'add', questsDone, ach);

          levelAchievements(s, ach);
          set(s);
          void mode;
          return {
            xpGained: xp,
            levelBefore,
            levelAfter: levelFromXp(s.xp).level,
            newAchievements: ach,
            questsDone,
            firstPass,
            newBest,
          };
        },

        addPracticeSeconds: (sec) => {
          const s = clone();
          const day = todayKey();
          s.days[day] = s.days[day] ?? { seconds: 0, xp: 0, attempts: 0 };
          s.days[day].seconds += sec;
          s.totals.seconds += sec;
          const ach: string[] = [];
          const done: Quest[] = [];
          progressQuest(s, 'minutes', Math.floor(s.days[day].seconds / 60), 'max', done, ach);
          if (s.totals.seconds >= 3600) unlockInto(s, 'hours_1', ach);
          if (s.totals.seconds >= 36000) unlockInto(s, 'hours_10', ach);
          set(s);
          return ach;
        },

        completeLesson: (lessonId) => {
          const s = clone();
          if (s.lessons[lessonId]?.completed) return null;
          const levelBefore = levelFromXp(s.xp).level;
          s.lessons[lessonId] = { ...(s.lessons[lessonId] ?? { quizBest: 0 }), completed: true, completedAt: Date.now() };
          addXp(s, XP_LESSON);
          const ach: string[] = [];
          const done: Quest[] = [];
          progressQuest(s, 'newLesson', 1, 'add', done, ach);
          levelAchievements(s, ach);
          set(s);
          return { xpGained: XP_LESSON, levelBefore, levelAfter: levelFromXp(s.xp).level, newAchievements: ach, questsDone: done, firstPass: true, newBest: false };
        },

        recordQuiz: (lessonId, correct, total) => {
          const s = clone();
          const levelBefore = levelFromXp(s.xp).level;
          const pct = Math.round((100 * correct) / Math.max(1, total));
          const prev = s.lessons[lessonId] ?? { completed: false, quizBest: 0 };
          const xp = Math.round(XP_QUIZ * (correct / Math.max(1, total))) + (pct >= 80 && prev.quizBest < 80 ? 15 : 0);
          s.lessons[lessonId] = { ...prev, quizBest: Math.max(prev.quizBest, pct) };
          addXp(s, xp);
          const ach: string[] = [];
          const done: Quest[] = [];
          if (pct === 100) progressQuest(s, 'quiz100', 1, 'add', done, ach);
          touchStreak(s, ach);
          // reading skill from note quizzes
          const old = s.skills.reading;
          s.skills.reading = old === undefined ? pct : Math.round(old * 0.8 + pct * 0.2);
          levelAchievements(s, ach);
          set(s);
          return { xpGained: xp, levelBefore, levelAfter: levelFromXp(s.xp).level, newAchievements: ach, questsDone: done, firstPass: false, newBest: false };
        },

        recordExam: (moduleId, score, passed) => {
          const s = clone();
          const levelBefore = levelFromXp(s.xp).level;
          const prev = s.exams[moduleId];
          const first = passed && !prev?.passed;
          s.exams[moduleId] = { passed: Boolean(prev?.passed || passed), best: Math.max(prev?.best ?? 0, score) };
          const xp = first ? XP_EXAM : 0;
          addXp(s, xp);
          const ach: string[] = [];
          if (passed) unlockInto(s, 'exam_1', ach);
          levelAchievements(s, ach);
          set(s);
          return { xpGained: xp, levelBefore, levelAfter: levelFromXp(s.xp).level, newAchievements: ach, questsDone: [], firstPass: first, newBest: false };
        },

        recordWarmup: () => {
          const s = clone();
          const levelBefore = levelFromXp(s.xp).level;
          s.totals.warmups += 1;
          addXp(s, 30);
          const ach: string[] = [];
          const done: Quest[] = [];
          progressQuest(s, 'warmup', 1, 'add', done, ach);
          if (s.totals.warmups >= 7) unlockInto(s, 'warmup_7', ach);
          touchStreak(s, ach);
          levelAchievements(s, ach);
          set(s);
          return { xpGained: 30, levelBefore, levelAfter: levelFromXp(s.xp).level, newAchievements: ach, questsDone: done, firstPass: false, newBest: false };
        },

        unlock: (id) => {
          const s = clone();
          const ach: string[] = [];
          unlockInto(s, id, ach);
          if (!ach.length) return false;
          set(s);
          return true;
        },

        questEvent: (kind, value = 1) => {
          const s = clone();
          const done: Quest[] = [];
          const ach: string[] = [];
          progressQuest(s, kind, value, 'add', done, ach);
          set(s);
          return done;
        },

        importState: (state) => set({ ...INITIAL, ...state }),
        reset: () => set(JSON.parse(JSON.stringify(INITIAL))),
      };
    },
    { name: 'sax.progress', version: 1 },
  ),
);

function stripActions(s: ProgressState & Actions): ProgressState {
  const { xp, exercises, lessons, exams, achievements, streak, days, quests, noteStats, skills, records, totals } = s;
  return { xp, exercises, lessons, exams, achievements, streak, days, quests, noteStats, skills, records, totals };
}

export const getProgress = () => useProgress.getState();
export const progressSnapshot = (): ProgressState => stripActions(useProgress.getState());
