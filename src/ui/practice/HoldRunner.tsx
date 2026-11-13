// Sustained-sound exercises: long tones, breath, mouthpiece, dynamics, vibrato.
import { useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import type { BreathExercise, DynamicsExercise, LongToneExercise, MouthpieceExercise, VibratoExercise, EvalResult } from '../../practice/types';
import { tolerances } from '../../practice/types';
import { audio } from '../../audio/engine';
import type { Frame } from '../../audio/dsp';
import { concertToWritten, fullNoteNameRu } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { evaluateBreath, evaluateDynamics, evaluateLongTone, evaluateMouthpiece, evaluateVibrato, mergeResults, MOUTHPIECE_TARGET } from '../../practice/evaluate';
import { useSettings, getSettings } from '../../store/settings';
import { playDemo } from '../../lib/demo';
import { cssVar } from '../../styles/themes';
import { FingeringDiagram } from '../notation/Fingering';
import { Kbd, ScoreRing } from '../components';
import { FrameCollector, LivePitch, MicBanner, saveAttempt, useKey, useMic, type FinishedAttempt, type RunContext } from './common';

type HoldEx = LongToneExercise | BreathExercise | MouthpieceExercise | DynamicsExercise | VibratoExercise;

export function HoldRunner({ ex, ctx, onFinish }: { ex: HoldEx; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  const mic = useMic();
  const strictness = useSettings((s) => s.strictness);
  const tol = { ...tolerances(ctx.tier, strictness) };
  tol.passScore = ctx.passScore ?? ex.passScore ?? tol.passScore;
  const targets: (number | null)[] = ex.kind === 'longtone' ? ex.notes : ex.kind === 'dynamics' || ex.kind === 'vibrato' ? [ex.note] : [null];
  const seconds = ex.seconds;
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'running' | 'between'>('idle');
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [breathCount, setBreathCount] = useState(0);
  const collector = useRef(new FrameCollector());
  const results = useRef<EvalResult[]>([]);
  const raf = useRef(0);
  const graph = useRef<HTMLCanvasElement>(null);
  const cancelled = useRef(false);

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const target = targets[step] ?? null;
  const isBreath = ex.kind === 'breath';
  const isMouth = ex.kind === 'mouthpiece';

  const soundStarted = (f: Frame) => {
    if (isBreath) {
      const thr = Math.max(getSettings().noiseFloorDb + 8, -62);
      return f.db > thr;
    }
    if (!f.voiced) return false;
    if (isMouth) return true;
    return target === null || Math.abs(concertToWritten(f.midi) - target) < 0.6;
  };

  const runStep = async (k: number) => {
    setStep(k);
    setElapsed(0);
    setPhase('waiting');
    collector.current.start();
    let startT = 0;
    let lastSound = 0;
    const off = audio.onFrame((f) => {
      if (!startT && soundStarted(f)) {
        startT = f.t;
        setPhase('running');
      }
      if (startT && soundStarted(f)) lastSound = f.t;
    });
    const loop = () => {
      if (cancelled.current) return;
      const now = audio.now();
      if (startT) {
        const el = now - startT;
        setElapsed(el);
        drawGraph();
        const silentFor = now - lastSound;
        const doneByTime = el >= seconds + 0.3;
        const doneBySilence = el > 0.8 && silentFor > (isBreath ? 0.6 : 0.45);
        if (doneByTime || doneBySilence) {
          off();
          const frames = collector.current.stop();
          finishStep(k, frames);
          return;
        }
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const finishStep = async (k: number, frames: Frame[]) => {
    let r: EvalResult;
    switch (ex.kind) {
      case 'longtone':
        r = evaluateLongTone(frames, ex.notes[k], seconds, tol);
        break;
      case 'breath':
        r = evaluateBreath(frames, seconds, getSettings().noiseFloorDb, tol);
        break;
      case 'mouthpiece':
        r = evaluateMouthpiece(frames, ex.part, seconds, tol);
        break;
      case 'dynamics':
        r = evaluateDynamics(frames, ex.note, ex.shape, seconds, tol);
        break;
      case 'vibrato':
        r = evaluateVibrato(frames, ex.note, seconds, ex.rate ?? [4.5, 6.5], ex.depth ?? [18, 60], tol);
        break;
    }
    results.current.push(r);
    if (k + 1 < targets.length) {
      setPhase('between');
      setTimeout(() => !cancelled.current && runStep(k + 1), 1800);
      return;
    }
    const merged = mergeResults(results.current, tol);
    const fin = await saveAttempt(ex, ctx, merged);
    setPhase('idle');
    onFinish(fin);
  };

  const start = async () => {
    if (phase !== 'idle') return;
    cancelled.current = false;
    if (mic.status !== 'on') await mic.retry();
    await audio.ensureContext();
    results.current = [];
    audio.startRecording();
    if (isBreath) {
      // short guided inhale
      for (let i = 3; i > 0; i--) {
        setBreathCount(i);
        await new Promise((r) => setTimeout(r, 900));
        if (cancelled.current) return;
      }
      setBreathCount(0);
    }
    runStep(0);
  };

  const cancel = () => {
    cancelled.current = true;
    cancelAnimationFrame(raf.current);
    collector.current.stop();
    audio.stopRecording();
    setPhase('idle');
    setBreathCount(0);
  };

  useKey(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'idle') start();
        else cancel();
      } else if (e.code === 'Escape') cancel();
    },
    [phase],
  );

  const drawGraph = () => {
    const c = graph.current;
    if (!c) return;
    const frames = collector.current.frames;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!frames.length) return;
    const t0 = frames[0].t;
    const span = seconds + 1;
    const X = (t: number) => ((t - t0) / span) * w;
    // pitch (cents vs target)
    const mid = h * 0.32;
    g.strokeStyle = cssVar('--border');
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(w, mid);
    g.stroke();
    g.fillStyle = 'rgba(61,255,168,0.12)';
    const band = (tol.centsGood / 100) * mid;
    g.fillRect(0, mid - band, w, band * 2);
    g.strokeStyle = cssVar('--accent');
    g.lineWidth = 2.5;
    g.beginPath();
    let first = true;
    const ref = isMouth ? MOUTHPIECE_TARGET[(ex as MouthpieceExercise).part] : null;
    for (const f of frames) {
      if (!f.voiced) {
        first = true;
        continue;
      }
      const cents = ref !== null ? (f.midi - ref) * 100 : target !== null ? (concertToWritten(f.midi) - target) * 100 : 0;
      const y = mid - Math.max(-100, Math.min(100, cents)) * (mid / 100);
      if (first) g.moveTo(X(f.t), y);
      else g.lineTo(X(f.t), y);
      first = false;
    }
    g.stroke();
    // loudness
    const base = h * 0.95;
    g.strokeStyle = cssVar('--accent-2');
    g.beginPath();
    first = true;
    for (const f of frames) {
      const y = base - Math.max(0, Math.min(1, (f.db + 70) / 60)) * (h * 0.38);
      if (first) g.moveTo(X(f.t), y);
      else g.lineTo(X(f.t), y);
      first = false;
    }
    g.stroke();
    g.fillStyle = cssVar('--muted');
    g.font = '12px Rubik';
    g.fillText(isBreath ? 'громкость выдоха' : 'громкость', 8, h * 0.62);
    if (!isBreath) g.fillText('высота (зелёная зона — точно)', 8, 14);
  };

  const pct = Math.min(100, (100 * elapsed) / seconds);
  const label =
    ex.kind === 'mouthpiece'
      ? ex.part === 'mouthpiece'
        ? 'Только мундштук'
        : 'Мундштук + эска'
      : ex.kind === 'breath'
        ? 'Выдох на «ссс»'
        : target !== null
          ? fullNoteNameRu(target)
          : '';

  return (
    <div>
      <MicBanner {...mic} />
      <div className="player">
        <div className="col" style={{ gap: 14 }}>
          <div className="stage" style={{ padding: 20 }}>
            <div className="row" style={{ gap: 24, alignItems: 'center' }}>
              <ScoreRing score={phase === 'running' ? pct : phase === 'idle' ? 0 : pct} size={170} />
              <div className="grow">
                {targets.length > 1 && (
                  <div className="small muted">
                    Нота {step + 1} из {targets.length}
                  </div>
                )}
                <div className="big-note" style={{ fontSize: 44 }}>
                  {label}
                </div>
                <div className="muted mt" style={{ fontSize: 18 }}>
                  {breathCount > 0
                    ? `Вдох… ${breathCount}`
                    : phase === 'idle'
                      ? 'Нажмите «Начать», затем играйте.'
                      : phase === 'waiting'
                        ? isBreath
                          ? 'Выдыхайте на «ссс»!'
                          : 'Начинайте играть — отсчёт пойдёт сам.'
                        : phase === 'between'
                          ? 'Отлично! Вдох — и следующая нота.'
                          : `${elapsed.toFixed(1)} с из ${seconds} с — держите ровно!`}
                </div>
              </div>
            </div>
            <canvas ref={graph} style={{ width: '100%', height: 180, marginTop: 14, display: 'block' }} />
          </div>
          <div className="card row">
            {phase === 'idle' ? (
              <button className="btn big" onClick={start} disabled={mic.status === 'error'}>
                <Play size={20} /> Начать <Kbd>Пробел</Kbd>
              </button>
            ) : (
              <button className="btn big danger" onClick={cancel}>
                <Square size={18} /> Стоп <Kbd>Esc</Kbd>
              </button>
            )}
            {target !== null && phase === 'idle' && (
              <button className="btn ghost" onClick={() => playDemo({ kind: 'note', note: target, seconds: Math.min(seconds, 5), vibrato: ex.kind === 'vibrato' })}>
                <Volume2 size={18} /> Как звучит
              </button>
            )}
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          {!isBreath && <LivePitch target={target} />}
          {target !== null && (
            <div className="card center">
              <FingeringDiagram fingering={mainFingering(target)} size={0.62} showLegend={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
