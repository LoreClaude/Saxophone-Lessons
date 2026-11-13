// Daily quests ("задания дня").

export type QuestKind =
  | 'attempts'
  | 'minutes'
  | 'stars3'
  | 'combo'
  | 'longtone'
  | 'score90'
  | 'newLesson'
  | 'intonation'
  | 'warmup'
  | 'quiz100';

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  target: number;
  progress: number;
  xp: number;
  done: boolean;
}

const TEMPLATES: Record<QuestKind, (goal: number) => Omit<Quest, 'id' | 'progress' | 'done'>> = {
  attempts: () => ({ kind: 'attempts', title: 'Сыграйте 5 упражнений', target: 5, xp: 40 }),
  minutes: (goal) => ({ kind: 'minutes', title: `Позанимайтесь ${goal} минут`, target: goal, xp: 50 }),
  stars3: () => ({ kind: 'stars3', title: 'Получите 3 звезды в любом упражнении', target: 1, xp: 50 }),
  combo: () => ({ kind: 'combo', title: 'Наберите комбо ×15', target: 15, xp: 40 }),
  longtone: () => ({ kind: 'longtone', title: 'Продержите ноту 8 секунд', target: 8, xp: 40 }),
  score90: () => ({ kind: 'score90', title: 'Наберите 90% и больше', target: 1, xp: 40 }),
  newLesson: () => ({ kind: 'newLesson', title: 'Пройдите новый урок', target: 1, xp: 60 }),
  intonation: () => ({ kind: 'intonation', title: '3 раза получите интонацию 85+', target: 3, xp: 40 }),
  warmup: () => ({ kind: 'warmup', title: 'Сделайте разминку дня', target: 1, xp: 50 }),
  quiz100: () => ({ kind: 'quiz100', title: 'Ответьте на тест без ошибок', target: 1, xp: 40 }),
};

export const QUEST_BONUS_XP = 60;

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/** Three quests for the given day; always includes practice minutes. */
export function questsForDay(day: string, dailyGoal: number): Quest[] {
  const rnd = seeded(day);
  const pool: QuestKind[] = ['attempts', 'stars3', 'combo', 'longtone', 'score90', 'newLesson', 'intonation', 'warmup', 'quiz100'];
  const picks: QuestKind[] = ['minutes'];
  while (picks.length < 3) {
    const k = pool[Math.floor(rnd() * pool.length)];
    if (!picks.includes(k)) picks.push(k);
  }
  return picks.map((k) => ({ ...TEMPLATES[k](dailyGoal), id: `${day}-${k}`, progress: 0, done: false }));
}
