// Experience, levels and ranks.
import type { ExerciseKind } from '../practice/types';

export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFromXp(xp: number) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  const cur = xpForLevel(l);
  const next = xpForLevel(l + 1);
  return { level: l, into: xp - cur, need: next - cur, progress: (xp - cur) / (next - cur) };
}

const RANKS: [number, string][] = [
  [1, 'Новичок'],
  [3, 'Ученик'],
  [6, 'Уличный музыкант'],
  [10, 'Клубный саксофонист'],
  [15, 'Сессионный музыкант'],
  [20, 'Солист'],
  [28, 'Джазовый мастер'],
  [36, 'Легенда'],
];

export function rankFor(level: number) {
  let r = RANKS[0][1];
  for (const [l, name] of RANKS) if (level >= l) r = name;
  return r;
}

export const DEFAULT_XP: Record<ExerciseKind, number> = {
  notes: 20,
  longtone: 20,
  breath: 15,
  mouthpiece: 15,
  sequence: 30,
  echo: 30,
  dynamics: 25,
  vibrato: 30,
  improv: 40,
};

export const XP_LESSON = 50;
export const XP_EXAM = 150;
export const XP_QUIZ = 20;
