// "Повтори за мной": listen to a phrase, then play it back by ear.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Ear, Eye } from 'lucide-react';
import type { EchoExercise } from '../../practice/types';
import { tolerances } from '../../practice/types';
import { parseScore } from '../../music/abc';
import { audio } from '../../audio/engine';
import { playMelody, type Session } from '../../audio/backing';
import { segmentNotes } from '../../audio/segment';
import { evaluateEcho, type EchoPhraseInput } from '../../practice/evaluate';
import { useSettings } from '../../store/settings';
import { playSfx } from '../../lib/toast';
import { Staff } from '../notation/Staff';
import { Kbd, Mascot } from '../components';
import { FrameCollector, LivePitch, MicBanner, saveAttempt, useKey, useMic, type FinishedAttempt, type RunContext } from './common';

export function EchoRunner({ ex, ctx, onFinish }: { ex: EchoExercise; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  const mic = useMic();
  const strictness = useSettings((s) => s.strictness);
  const tol = { ...tolerances(ctx.tier, strictness) };
  tol.passScore = ctx.passScore ?? ex.passScore ?? tol.passScore;
  const scores = useMemo(() => ex.phrases.map((p) => parseScore(p)), [ex.phrases]);
  const [phase, setPhase] = useState<'idle' | 'listen' | 'play' | 'pause'>('idle');
  const [k, setK] = useState(0);
  const [reveal, setReveal] = useState(false);
  const cancelled = useRef(false);
  const sess = useRef<Session | null>(null);
  const collector = useRef(new FrameCollector());

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const start = async () => {
    if (phase !== 'idle') return;
    cancelled.current = false;
    if (mic.status !== 'on') await mic.retry();
    await audio.ensureContext();
    audio.startRecording();
    const inputs: EchoPhraseInput[] = [];
    for (let i = 0; i < scores.length; i++) {
      if (cancelled.current) return;
      setK(i);
      setReveal(false);
      setPhase('listen');
      const sc = scores[i];
      const dur = (sc.totalBeats * 60) / ex.bpm;
      sess.current = await playMelody(sc, ex.bpm);
      await wait(dur * 1000 + 300);
      if (cancelled.current) return;
      setPhase('play');
      playSfx('tap');
      collector.current.start();
      const startAt = audio.now();
      let heard = 0;
      let lastVoice = 0;
      const off = audio.onFrame((f) => {
        if (f.voiced) {
          heard++;
          lastVoice = f.t;
        }
      });
      // wait until the phrase is played back (or time runs out)
      for (;;) {
        await wait(100);
        if (cancelled.current) {
          off();
          return;
        }
        const now = audio.now();
        const longEnough = now - startAt > dur + 3;
        const finished = heard > 10 && now - lastVoice > 1.2;
        if (longEnough || finished) break;
      }
      off();
      const frames = collector.current.stop();
      inputs.push({ expected: sc.notes, bpm: ex.bpm, detected: segmentNotes(frames) });
      setReveal(true);
      setPhase('pause');
      await wait(1200);
    }
    const result = evaluateEcho(inputs, tol);
    result.durationSec = 0;
    const fin = await saveAttempt(ex, ctx, result, 'на слух');
    setPhase('idle');
    onFinish(fin);
  };

  const cancel = () => {
    cancelled.current = true;
    sess.current?.stop();
    collector.current.stop();
    audio.stopRecording();
    setPhase('idle');
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

  return (
    <div>
      <MicBanner {...mic} />
      <div className="player">
        <div className="col" style={{ gap: 14 }}>
          <div className="stage" style={{ display: 'grid', placeItems: 'center', minHeight: 320, padding: 20 }}>
            <div className="center col" style={{ alignItems: 'center' }}>
              <Mascot size={110} mood={phase === 'listen' ? 'cool' : phase === 'play' ? 'wow' : 'happy'} float />
              <div className="small muted">
                Фраза {k + 1} из {scores.length}
              </div>
              <h2 className="display">
                {phase === 'idle' ? 'Слушайте и повторяйте' : phase === 'listen' ? (
                  <>
                    <Ear /> Слушайте…
                  </>
                ) : phase === 'play' ? (
                  'Ваша очередь!'
                ) : (
                  'Так звучала фраза:'
                )}
              </h2>
              {reveal && (
                <div style={{ width: 520, maxWidth: '100%' }}>
                  <Staff abc={ex.phrases[k]} showNames scale={1.1} />
                </div>
              )}
              {phase === 'idle' && (
                <p className="muted">Я сыграю короткую фразу. После сигнала повторите её на саксофоне — по слуху, без нот.</p>
              )}
            </div>
          </div>
          <div className="card row">
            {phase === 'idle' ? (
              <button className="btn big" onClick={start} disabled={mic.status === 'error'}>
                <Play size={20} /> Начать <Kbd>Пробел</Kbd>
              </button>
            ) : (
              <button className="btn big danger" onClick={cancel}>
                <Square size={18} /> Стоп
              </button>
            )}
            {phase === 'idle' && (
              <span className="small muted row">
                <Eye size={16} /> Ноты фразы откроются после вашего ответа.
              </span>
            )}
          </div>
        </div>
        <div className="col">
          <LivePitch />
        </div>
      </div>
    </div>
  );
}
