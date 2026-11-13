// Shared pieces for exercise runners.
import { useEffect, useRef, useState } from 'react';
import { MicOff } from 'lucide-react';
import { audio, pcmToWav, downsample, type MicStatus } from '../../audio/engine';
import type { Frame } from '../../audio/dsp';
import { useSettings, getSettings } from '../../store/settings';
import { useProgress, type AttemptOutcome } from '../../store/progress';
import { db, todayKey } from '../../store/db';
import { noteNameRu, concertToWritten, octaveOf } from '../../music/notes';
import type { EvalResult, Exercise, ExerciseKind, Tier } from '../../practice/types';
import { navigate } from '../../lib/router';

export interface RunContext {
  exerciseKey: string;
  lessonId: string;
  lessonTitle?: string;
  tier: Tier;
  /** Overrides the exercise pass score (exams). */
  passScore?: number;
  xpBase?: number;
  /** Do not write progress (free practice of user pieces counts separately). */
  practiceOnly?: boolean;
}

export interface FinishedAttempt {
  result: EvalResult;
  outcome: AttemptOutcome | null;
  attemptId?: number;
  recording?: Blob | null;
  mode?: string;
  attemptNo: number;
  previousBest?: number;
}

/** Starts the microphone with the saved device. */
export function useMic() {
  const deviceId = useSettings((s) => s.micDeviceId);
  const [status, setStatus] = useState<MicStatus>(audio.status);
  const [error, setError] = useState(audio.error);
  useEffect(() => {
    const off = audio.statusChanged.on((s) => {
      setStatus(s);
      setError(audio.error);
    });
    audio.startMic(deviceId || undefined).catch(() => setError(audio.error));
    return off;
  }, [deviceId]);
  return { status, error, retry: () => audio.startMic(deviceId || undefined).catch(() => setError(audio.error)) };
}

export function MicBanner({ status, error, retry }: { status: MicStatus; error: string; retry: () => void }) {
  if (status === 'on' || status === 'starting') return null;
  return (
    <div className="card row" style={{ borderColor: 'var(--bad)', marginBottom: 14 }}>
      <MicOff color="var(--bad)" />
      <div className="grow">
        <b>Микрофон не работает</b>
        <div className="small muted">{error || 'Разрешите доступ к микрофону.'}</div>
      </div>
      <button className="btn ghost" onClick={retry}>
        Повторить
      </button>
      <button className="btn ghost" onClick={() => navigate('/settings')}>
        Настройки
      </button>
    </div>
  );
}

/** Collects frames between start() and stop(). */
export class FrameCollector {
  frames: Frame[] = [];
  private off: (() => void) | null = null;
  start() {
    this.frames = [];
    this.off?.();
    this.off = audio.onFrame((f) => this.frames.push(f));
  }
  stop() {
    this.off?.();
    this.off = null;
    return this.frames;
  }
}

/** Latency compensation (seconds) = estimated device latency + calibration. */
export function latencySec() {
  const l = audio.latency();
  return l.output + l.input + getSettings().latencyMs / 1000;
}

export async function saveAttempt(
  ex: Exercise,
  ctx: RunContext,
  result: EvalResult,
  mode?: string,
  recordRecording = true,
): Promise<FinishedAttempt> {
  const prog = useProgress.getState();
  const prev = prog.exercises[ctx.exerciseKey];
  let recording: Blob | null = null;
  if (recordRecording) {
    const rec = await audio.stopRecording();
    if (rec && rec.pcm.length > 0) {
      const small = downsample(rec.pcm, rec.sampleRate, 16000);
      recording = pcmToWav(small.slice(0, 16000 * 60), 16000);
    }
  }
  const outcome = ctx.practiceOnly ? null : prog.recordAttempt({ exerciseKey: ctx.exerciseKey, kind: ex.kind as ExerciseKind, result, xpBase: ctx.xpBase ?? ex.xp, mode });
  let attemptId: number | undefined;
  try {
    let recordingId: number | undefined;
    if (recording && getSettings().keepRecordings) {
      recordingId = await db.recordings.add({ date: Date.now(), blob: recording, sampleRate: 16000, seconds: result.durationSec, title: ex.title });
    }
    attemptId = await db.attempts.add({
      date: Date.now(),
      day: todayKey(),
      lessonId: ctx.lessonId,
      exerciseId: ctx.exerciseKey,
      kind: ex.kind,
      title: ex.title,
      mode,
      score: result.score,
      passed: result.passed,
      stars: result.stars,
      criteria: result.criteria,
      metrics: result.metrics,
      durationSec: result.durationSec,
      recordingId,
    });
    if (recordingId) await db.recordings.update(recordingId, { attemptId });
  } catch (e) {
    console.warn('attempt save failed', e);
  }
  return { result, outcome, attemptId, recording, mode, attemptNo: (prev?.attempts ?? 0) + 1, previousBest: prev?.best };
}

/** Live pitch readout: note name (written) and a cents needle. */
export function LivePitch({ target, compact }: { target?: number | null; compact?: boolean }) {
  const [state, setState] = useState<{ name: string; oct: number; cents: number; voiced: boolean; db: number }>({ name: '—', oct: 0, cents: 0, voiced: false, db: -100 });
  const raf = useRef(0);
  useEffect(() => {
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 50) {
        last = t;
        const f = audio.lastFrame;
        if (f && f.voiced && audio.now() - f.t < 0.25) {
          const w = concertToWritten(f.midi);
          const nearest = target !== undefined && target !== null && Math.abs(w - target) < 0.6 ? target : Math.round(w);
          setState({ name: noteNameRu(nearest), oct: octaveOf(nearest), cents: (w - nearest) * 100, voiced: true, db: f.db });
        } else setState((s) => ({ ...s, voiced: false, db: f?.db ?? -100 }));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  const c = Math.max(-50, Math.min(50, state.cents));
  const ok = Math.abs(state.cents) < 15;
  return (
    <div className="card" style={{ padding: compact ? 10 : 16 }}>
      <div className="row between">
        <span className="small muted">Слышу</span>
        <span className="small muted">{state.voiced ? `${state.cents > 0 ? '+' : ''}${Math.round(state.cents)} ц` : ''}</span>
      </div>
      <div className="center display" style={{ fontSize: compact ? 30 : 42, fontWeight: 800, color: state.voiced ? (ok ? 'var(--good)' : 'var(--text)') : 'var(--muted)', lineHeight: 1.2 }}>
        {state.voiced ? state.name : '…'}
      </div>
      <div style={{ position: 'relative', height: 16, marginTop: 6 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 2, background: 'var(--border)' }} />
        <div style={{ position: 'absolute', left: '35%', width: '30%', top: 4, height: 8, borderRadius: 6, background: 'color-mix(in srgb, var(--good) 30%, transparent)' }} />
        <div
          style={{
            position: 'absolute',
            left: `calc(${50 + c}% - 2px)`,
            top: 0,
            width: 4,
            height: 16,
            borderRadius: 3,
            background: state.voiced ? (ok ? 'var(--good)' : 'var(--accent)') : 'var(--muted)',
            transition: 'left 0.08s linear',
          }}
        />
      </div>
      <div className="row between tiny muted">
        <span>ниже</span>
        <span>точно</span>
        <span>выше</span>
      </div>
    </div>
  );
}

/** Live input level bar. */
export function LevelMeter() {
  const [db, setDb] = useState(-100);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 60) {
        last = t;
        setDb(audio.lastFrame?.db ?? -100);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const v = Math.max(0, Math.min(100, (db + 70) * 1.6));
  return (
    <div className="bar" title={`${Math.round(db)} дБ`}>
      <div style={{ width: `${v}%`, background: v > 92 ? 'var(--bad)' : undefined }} />
    </div>
  );
}

export function useKey(handler: (e: KeyboardEvent) => void, deps: unknown[]) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      handler(e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Countdown({ value }: { value: number }) {
  return (
    <div className="countdown" key={value}>
      {value > 0 ? value : 'Играйте!'}
    </div>
  );
}

export const JUDGE_TEXT: Record<string, [string, string]> = {
  perfect: ['Идеально!', 'var(--good)'],
  good: ['Хорошо', 'var(--good)'],
  ok: ['Неточно', 'var(--ok)'],
  wrong: ['Не та нота', 'var(--bad)'],
  miss: ['Мимо', 'var(--bad)'],
};
