// Improvisation over a backing track with live "in scale" feedback.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import type { ImprovExercise } from '../../practice/types';
import { tolerances } from '../../practice/types';
import { audio } from '../../audio/engine';
import { startSession, type Session, STYLE_NAMES } from '../../audio/backing';
import { parseChordChart, scaleNotes, SCALES, scalePcs, parseChord, chordPcs } from '../../music/theory';
import { concertToWritten, noteNameRu } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { evaluateImprov } from '../../practice/evaluate';
import { useSettings, getSettings } from '../../store/settings';
import { playDemo } from '../../lib/demo';
import { MiniFingering } from '../notation/Fingering';
import { Kbd, Toggle } from '../components';
import { Countdown, FrameCollector, LivePitch, MicBanner, latencySec, saveAttempt, useKey, useMic, type FinishedAttempt, type RunContext } from './common';

export function ImprovRunner({ ex, ctx, onFinish }: { ex: ImprovExercise; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  const mic = useMic();
  const strictness = useSettings((s) => s.strictness);
  const tol = { ...tolerances(ctx.tier, strictness) };
  tol.passScore = ctx.passScore ?? ex.passScore ?? tol.passScore;
  const chart = useMemo(() => parseChordChart(ex.chords), [ex.chords]);
  const [bpm, setBpm] = useState(ex.bpm);
  const [metronome, setMetronome] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'count' | 'run'>('idle');
  const [count, setCount] = useState(0);
  const [bar, setBar] = useState(-1);
  const [inScale, setInScale] = useState<boolean | null>(null);
  const sess = useRef<Session | null>(null);
  const collector = useRef(new FrameCollector());
  const timer = useRef(0);
  const cancelled = useRef(false);
  const swing = ex.style === 'swing' || ex.style === 'blues';

  // scale notes in a playable range around the written root
  const root = 60 + (ex.scale.root % 12);
  const scale = scaleNotes(root < 62 ? root + 12 : root, ex.scale.type, 1).filter((m) => m >= 58 && m <= 86);
  const pcs = scalePcs(ex.scale.root % 12, ex.scale.type);

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (phase !== 'idle') return;
    cancelled.current = false;
    if (mic.status !== 'on') await mic.retry();
    const s = getSettings();
    const total = ex.bars * 4;
    const session = await startSession({
      bpm,
      beatsPerBar: 4,
      countInBars: 1,
      totalBeats: total,
      metronome,
      metronomeVolume: s.metronomeVolume * 0.7,
      style: ex.style,
      chords: chart,
      backingVolume: s.backingVolume,
      onBeat: (b) => {
        if (b < 0) {
          setCount(-b);
          setPhase('count');
        } else {
          setCount(0);
          setPhase('run');
          setBar(Math.floor(b / 4));
        }
      },
    });
    sess.current = session;
    collector.current.start();
    audio.startRecording();
    const off = audio.onFrame((f) => {
      if (!f.voiced) {
        setInScale(null);
        return;
      }
      const w = Math.round(concertToWritten(f.midi));
      const beat = session.timeToBeat(f.t - latencySec());
      const b = Math.max(0, Math.floor(beat / 4));
      const bc = chart[b % chart.length];
      const sym = bc?.[Math.min(bc.length - 1, Math.floor((beat - b * 4) / (4 / bc.length)))];
      const ok = pcs.has(((w % 12) + 12) % 12) || (sym ? chordPcs(parseChord(sym)).has(((w % 12) + 12) % 12) : false);
      setInScale(ok);
    });
    const endMs = (session.t0 + total * (60 / bpm) + 0.6 - audio.now()) * 1000;
    timer.current = window.setTimeout(async () => {
      off();
      session.stop();
      const frames = collector.current.stop();
      if (cancelled.current) return;
      const result = evaluateImprov(frames, { t0: session.t0, bpm, beatsPerBar: 4, bars: ex.bars, chords: chart, scale: ex.scale, swing, latency: latencySec() }, tol);
      const fin = await saveAttempt(ex, ctx, result, `импровизация ${bpm}`);
      setPhase('idle');
      setBar(-1);
      onFinish(fin);
    }, endMs);
  };

  const cancel = () => {
    cancelled.current = true;
    window.clearTimeout(timer.current);
    sess.current?.stop();
    collector.current.stop();
    audio.stopRecording();
    setPhase('idle');
    setBar(-1);
  };

  useKey(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'idle') start();
        else cancel();
      } else if (e.code === 'Escape') cancel();
    },
    [phase, bpm, metronome],
  );

  const curBar = bar >= 0 ? bar % chart.length : -1;
  return (
    <div>
      <MicBanner {...mic} />
      <div className="player">
        <div className="col" style={{ gap: 14 }}>
          <div className="stage" style={{ padding: 20 }}>
            {phase === 'count' && count > 0 && <Countdown value={count} />}
            <div className="row between">
              <div>
                <div className="small muted">
                  {STYLE_NAMES[ex.style]} · {bpm} уд/мин · {ex.bars} тактов
                </div>
                <h3 style={{ margin: '4px 0' }}>
                  Гамма: {noteNameRu(ex.scale.root)} — {SCALES[ex.scale.type].name}
                </h3>
              </div>
              {phase === 'run' && (
                <div className="chip" style={{ fontSize: 16, padding: '8px 14px', borderColor: inScale === null ? undefined : inScale ? 'var(--good)' : 'var(--ok)', color: inScale === null ? undefined : inScale ? 'var(--good)' : 'var(--ok)' }}>
                  {inScale === null ? 'пауза — тоже музыка' : inScale ? 'в гамме ✓' : 'чужая нота — проходящая?'}
                </div>
              )}
            </div>
            <div className="grid mt" style={{ gridTemplateColumns: `repeat(${Math.min(4, chart.length)}, 1fr)`, gap: 8 }}>
              {chart.map((c, i) => (
                <div
                  key={i}
                  className="card center"
                  style={{
                    padding: 12,
                    borderColor: i === curBar ? 'var(--accent)' : undefined,
                    boxShadow: i === curBar ? '0 0 0 3px var(--glow)' : undefined,
                    transition: 'all .15s',
                  }}
                >
                  <div className="display" style={{ fontSize: 20, fontWeight: 800 }}>
                    {c.join(' ')}
                  </div>
                  <div className="tiny muted">такт {i + 1}</div>
                </div>
              ))}
            </div>
            <div className="mt">
              <div className="small muted mb">Ноты гаммы (аппликатуры):</div>
              <div className="row wrap" style={{ gap: 14 }}>
                {scale.map((m) => (
                  <div key={m} className="center" style={{ cursor: 'pointer' }} onClick={() => playDemo({ kind: 'note', note: m, seconds: 0.8 })}>
                    <MiniFingering fingering={mainFingering(m)} height={56} />
                    <div className="small">
                      <b>{noteNameRu(m)}</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card row wrap" style={{ gap: 16 }}>
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
              <>
                <button className="btn ghost" onClick={() => playDemo({ kind: 'backing', style: ex.style, chords: ex.chords, bpm, bars: Math.min(ex.bars, chart.length * 2) })}>
                  <Volume2 size={18} /> Послушать аккомпанемент
                </button>
                <div className="row" style={{ minWidth: 260 }}>
                  <span className="small">Темп</span>
                  <input type="range" min={Math.round(ex.bpm * 0.6)} max={Math.round(ex.bpm * 1.3)} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                  <b>{bpm}</b>
                </div>
                <Toggle on={metronome} onChange={setMetronome} label="Метроном" />
              </>
            )}
          </div>
          {ex.focus && <div className="card small">🎯 {ex.focus}</div>}
        </div>
        <div className="col">
          <LivePitch />
        </div>
      </div>
    </div>
  );
}
