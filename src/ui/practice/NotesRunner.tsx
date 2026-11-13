// "Найди ноту": random notes shown as staff / name / fingering; the app waits
// for the right note and measures reaction time and intonation.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, SkipForward, Volume2 } from 'lucide-react';
import type { NotesExercise } from '../../practice/types';
import { tolerances } from '../../practice/types';
import { audio } from '../../audio/engine';
import { concertToWritten, fullNoteNameRu, noteNameRu } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { buildAbc } from '../../music/abc';
import { evaluateWait, type WaitNoteRecord } from '../../practice/evaluate';
import { useSettings } from '../../store/settings';
import { playDemo } from '../../lib/demo';
import { playSfx } from '../../lib/toast';
import { Staff } from '../notation/Staff';
import { FingeringDiagram, FingeringLegend } from '../notation/Fingering';
import { Bar, Kbd } from '../components';
import { FrameCollector, LivePitch, MicBanner, saveAttempt, useKey, useMic, type FinishedAttempt, type RunContext } from './common';

type Show = 'staff' | 'name' | 'fingering';

export function NotesRunner({ ex, ctx, onFinish }: { ex: NotesExercise; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  const mic = useMic();
  const strictness = useSettings((s) => s.strictness);
  const tol = tolerances(ctx.tier, strictness);
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
  const [holdPct, setHoldPct] = useState(0);
  const offRef = useRef<(() => void) | null>(null);
  const collector = useRef(new FrameCollector());
  const skipRef = useRef<(() => void) | null>(null);

  const plan = useMemo(() => {
    const items: { note: number; show: Show }[] = [];
    let last = -1;
    for (let i = 0; i < ex.count; i++) {
      let m = ex.ordered ? ex.pool[i % ex.pool.length] : ex.pool[Math.floor(Math.random() * ex.pool.length)];
      if (!ex.ordered && ex.pool.length > 1) while (m === last) m = ex.pool[Math.floor(Math.random() * ex.pool.length)];
      last = m;
      const show: Show = ex.show === 'mixed' ? (['staff', 'name', 'fingering'] as Show[])[i % 3] : ex.show;
      items.push({ note: m, show });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex, running]);

  useEffect(() => () => offRef.current?.(), []);

  const start = async () => {
    if (running) return;
    if (mic.status !== 'on') await mic.retry();
    await audio.ensureContext();
    setRunning(true);
    setIdx(0);
    collector.current.start();
    audio.startRecording();
    const records: WaitNoteRecord[] = [];
    const t0 = audio.now();
    let i = 0;
    let since = audio.now();
    let hold: { start: number; cents: number[] } | null = null;
    let wrong: { midi: number; start: number; counted: boolean } | null = null;
    let wrongCount = 0;
    let needRelease = false;
    const next = (skipped: boolean, cents: number[]) => {
      const m = cents.length ? cents.reduce((a, b) => a + b, 0) / cents.length : 0;
      records.push({ expected: plan[i].note, reaction: audio.now() - since, wrongAttempts: wrongCount, cents: m, std: 0, skipped });
      if (!skipped) {
        playSfx(wrongCount ? 'hit' : 'perfect');
        setFlash('good');
        setTimeout(() => setFlash(null), 350);
      }
      i++;
      wrongCount = 0;
      hold = null;
      wrong = null;
      setHoldPct(0);
      since = audio.now();
      needRelease = i < plan.length && plan[i].note === plan[i - 1].note;
      if (i >= plan.length) {
        offRef.current?.();
        offRef.current = null;
        finish(records, audio.now() - t0);
      } else setIdx(i);
    };
    skipRef.current = () => next(true, []);
    offRef.current = audio.onFrame((f) => {
      if (i >= plan.length) return;
      const target = plan[i].note;
      if (!f.voiced) {
        hold = null;
        wrong = null;
        needRelease = false;
        setHoldPct(0);
        return;
      }
      const w = concertToWritten(f.midi);
      if (Math.round(w) === target) {
        if (needRelease) return;
        if (!hold) hold = { start: f.t, cents: [] };
        hold.cents.push((w - target) * 100);
        const ms = (f.t - hold.start) * 1000;
        setHoldPct(Math.min(100, (100 * ms) / tol.holdMs));
        if (ms >= tol.holdMs) next(false, hold.cents);
      } else {
        hold = null;
        setHoldPct(0);
        if (!wrong || wrong.midi !== Math.round(w)) wrong = { midi: Math.round(w), start: f.t, counted: false };
        else if (!wrong.counted && f.t - wrong.start > 0.12) {
          wrong.counted = true;
          wrongCount++;
          setFlash('wrong');
          setTimeout(() => setFlash(null), 300);
        }
      }
    });
  };

  const finish = async (records: WaitNoteRecord[], seconds: number) => {
    collector.current.stop();
    const result = evaluateWait(records, { ...tol, passScore: ctx.passScore ?? ex.passScore ?? tol.passScore }, ctx.tier, seconds);
    const fin = await saveAttempt(ex, ctx, result, 'найди ноту');
    setRunning(false);
    onFinish(fin);
  };

  const cancel = () => {
    offRef.current?.();
    offRef.current = null;
    collector.current.stop();
    audio.stopRecording();
    setRunning(false);
  };

  useKey(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!running) start();
        else cancel();
      } else if (e.code === 'KeyS' && running) skipRef.current?.();
      else if (e.code === 'Escape' && running) cancel();
    },
    [running],
  );

  const item = plan[Math.min(idx, plan.length - 1)];
  return (
    <div>
      <MicBanner {...mic} />
      <div className="player">
        <div className="col" style={{ gap: 14 }}>
          <div className="stage" style={{ minHeight: 360, display: 'grid', placeItems: 'center', borderColor: flash === 'good' ? 'var(--good)' : flash === 'wrong' ? 'var(--bad)' : undefined, transition: 'border-color .2s' }}>
            {!running ? (
              <div className="center col" style={{ alignItems: 'center' }}>
                <h2>Готовы?</h2>
                <p className="muted">
                  Будет {ex.count} нот. Сыграйте каждую и держите, пока полоска не заполнится.
                </p>
                <button className="btn big" onClick={start} disabled={mic.status === 'error'}>
                  <Play size={20} /> Начать <Kbd>Пробел</Kbd>
                </button>
              </div>
            ) : (
              <div className="target-box">
                <div className="small muted">
                  Нота {idx + 1} из {plan.length}
                </div>
                {item.show === 'name' && <div className="big-note">{fullNoteNameRu(item.note)}</div>}
                {item.show === 'staff' && (
                  <div style={{ width: 320 }}>
                    <Staff abc={buildAbc([{ midi: item.note, beats: 4 }], { key: 'C' }).replace('M:4/4', 'M:none')} scale={2} />
                  </div>
                )}
                {item.show === 'fingering' && <FingeringDiagram fingering={mainFingering(item.note)} size={1.05} />}
                <div style={{ width: 300 }}>
                  <Bar value={holdPct} />
                </div>
              </div>
            )}
          </div>
          {running && (
            <div className="card row">
              <button className="btn danger" onClick={cancel}>
                <Square size={16} /> Стоп <Kbd>Esc</Kbd>
              </button>
              <button className="btn ghost" onClick={() => skipRef.current?.()}>
                <SkipForward size={16} /> Не знаю, пропустить <Kbd>S</Kbd>
              </button>
              <button className="btn ghost" onClick={() => playDemo({ kind: 'note', note: item.note })}>
                <Volume2 size={16} /> Подсказка звуком
              </button>
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 14 }}>
          <LivePitch target={running ? item.note : null} />
          {running && item.show !== 'fingering' && (
            <details className="card">
              <summary style={{ cursor: 'pointer' }}>Подсказка: аппликатура {noteNameRu(item.note)}</summary>
              <div className="center">
                <FingeringDiagram fingering={mainFingering(item.note)} size={0.95} showLegend={false} />
                <FingeringLegend fingering={mainFingering(item.note)} />
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
