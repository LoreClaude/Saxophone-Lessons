// Toast notifications and celebration helpers.
import { create } from 'zustand';
import confetti from 'canvas-confetti';
import { ACH_BY_ID } from '../game/achievements';
import { sfx, type Sfx } from '../audio/synth';
import { getSettings } from '../store/settings';
import type { AttemptOutcome } from '../store/progress';
import { rankFor } from '../game/levels';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
}

interface ToastStore {
  toasts: Toast[];
  levelUp: { level: number; rank: string } | null;
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
  setLevelUp: (v: { level: number; rank: string } | null) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  levelUp: null,
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setLevelUp: (v) => set({ levelUp: v }),
}));

export const toast = (icon: string, title: string, text?: string) => useToasts.getState().push({ icon, title, text });

export function playSfx(kind: Sfx) {
  if (getSettings().sfx) sfx(kind);
}

export function burst(big = false) {
  if (!getSettings().animations) return;
  const colors = ['#ff4fd8', '#3df2ff', '#ffd23f', '#3dffa8', '#ff8a3d'];
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
  if (big)
    setTimeout(
      () => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true }),
      250,
    );
}

/** Shows toasts / effects for what an attempt unlocked. */
export function celebrate(o: AttemptOutcome | null) {
  if (!o) return;
  for (const id of o.newAchievements) {
    const a = ACH_BY_ID[id];
    if (a) {
      toast(a.icon, `Достижение: ${a.title}`, a.description + (a.xp ? ` · +${a.xp} XP` : ''));
      playSfx('achievement');
    }
  }
  for (const q of o.questsDone) {
    toast('🎯', 'Задание дня выполнено!', `${q.title} · +${q.xp} XP`);
    playSfx('coin');
  }
  if (o.levelAfter > o.levelBefore) {
    useToasts.getState().setLevelUp({ level: o.levelAfter, rank: rankFor(o.levelAfter) });
    playSfx('levelup');
    burst(true);
  }
}
