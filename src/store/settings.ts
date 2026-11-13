// User settings (persisted in localStorage).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Strictness } from '../practice/types';
import type { ThemeId } from '../styles/themes';

export interface AiSettings {
  enabled: boolean;
  model: string;
  /** Ask the tutor for a comment after every exercise automatically. */
  autoFeedback: boolean;
  /** Send a short recording to models that accept audio. */
  sendAudio: boolean;
  /** Monthly spend warning in USD (0 = off). */
  budgetUsd: number;
}

export interface Settings {
  onboardingDone: boolean;
  userName: string;
  theme: ThemeId;
  micDeviceId: string;
  inputGain: number;
  gateDb: number;
  noiseFloorDb: number;
  a4: number;
  /** Extra latency compensation in milliseconds (calibrated). */
  latencyMs: number;
  strictness: Strictness;
  showNoteNames: boolean;
  showFingerings: boolean;
  tunerConcert: boolean;
  sfx: boolean;
  animations: boolean;
  metronomeVolume: number;
  backingVolume: number;
  melodyVolume: number;
  masterVolume: number;
  metronomeSound: 'wood' | 'click' | 'beep';
  autoStartOnSound: boolean;
  countdownSec: number;
  keepRecordings: boolean;
  dailyGoalMin: number;
  ai: AiSettings;
  reminders: { enabled: boolean; time: string; days: number[] };
  minimizeToTray: boolean;
  launchAtLogin: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  userName: '',
  theme: 'neon',
  micDeviceId: '',
  inputGain: 1,
  gateDb: -55,
  noiseFloorDb: -70,
  a4: 440,
  latencyMs: 0,
  strictness: 'normal',
  showNoteNames: true,
  showFingerings: true,
  tunerConcert: false,
  sfx: true,
  animations: true,
  metronomeVolume: 0.8,
  backingVolume: 0.8,
  melodyVolume: 0.8,
  masterVolume: 0.9,
  metronomeSound: 'wood',
  autoStartOnSound: false,
  countdownSec: 3,
  keepRecordings: true,
  dailyGoalMin: 20,
  ai: { enabled: true, model: '', autoFeedback: true, sendAudio: false, budgetUsd: 5 },
  reminders: { enabled: false, time: '19:00', days: [1, 2, 3, 4, 5, 6, 0] },
  minimizeToTray: false,
  launchAtLogin: false,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setAi: (patch: Partial<AiSettings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      reset: () => set({ ...DEFAULT_SETTINGS, onboardingDone: true }),
    }),
    {
      name: 'sax.settings',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, ai: { ...current.ai, ...(p.ai ?? {}) }, reminders: { ...current.reminders, ...(p.reminders ?? {}) } };
      },
    },
  ),
);

export const getSettings = () => useSettings.getState();
