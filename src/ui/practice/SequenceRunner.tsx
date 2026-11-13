// Playing from notation: tempo mode (with metronome/backing, live judgments)
// and wait mode (the app waits for each correct note).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Volume2, SkipForward } from 'lucide-react';
import type { SequenceExercise } from '../../practice/types';
import { tolerances } from '../../practice/types';
import { parseScore, type Score } from '../../music/abc';
import { parseChordChart } from '../../music/theory';
import { audio } from '../../audio/engine';
import { startSession, type Session, STYLE_NAMES } from '../../audio/backing';
import { concertToWritten, noteNameRu } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { evaluateSequence, evaluateWait, comboMultiplier, JUDGMENT_POINTS, type WaitNoteRecord } from '../../practice/evaluate';
import { swingBeat } from '../../music/rhythm';
import { useSettings, getSettings } from '../../store/settings';
import { playDemo, stopDemo } from '../../lib/demo';
import { playSfx } from '../../lib/toast';
import { Staff, type StaffHandle, type NoteState } from '../notation/Staff';
import { FingeringDiagram } from '../notation/Fingering';
import { Seg, Toggle, Kbd } from '../components';
import { LaneView } from './LaneView';
import { Countdown, FrameCollector, JUDGE_TEXT, LivePitch, MicBanner, latencySec, saveAttempt, useKey, useMic, type FinishedAttempt, type RunContext } from './common';

type Phase = 'idle' | 'countdown' | 'running';

interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export function SequenceRunner({ ex, ctx, onFinish }: { ex: SequenceExercise; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  const mic = useMic();
  const settings = useSettings();
  const baseScore = useMemo(() => parseScore(ex.abc), [ex.abc]);
  const modes = ex.modes ?? ['tempo', 'wait'];
  const [mode, setMode] = useState<'tempo' | 'wait'>(modes[0]);
  const baseBpm = ex.bpm ?? baseScore.bpm;
  const [bpm, setBpm] = useState(baseBpm);
  const [metronome, setMetronome] = useState(ex.metronome ?? true);
  const [backing, setBacking] = useState(Boolean(ex.style && ex.style !== 'none'));
  const [guide, setGuide] = useState(false);
  const [view, setView] = useState<'staff' | 'lane'>('staff');
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [points, setPoints] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const staff = useRef<StaffHandle>(null);
  const session = useRef<Session | null>(null);
  const collector = useRef(new FrameCollector());
  const states = useRef<NoteState[]>([]);
  const raf = useRef(0);
  const cancelled = useRef(false);
  const tol = tolerances(ctx.tier, settings.strictness);
  const score: Score = baseScore;

  useEffect(() => () => stop(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPop = (i: number, judgment: string) => {
    const r = staff.current?.noteRect(i);
    if (!r || view !== 'staff') return;
    const [text, color] = JUDGE_TEXT[judgment];
    const id = Math.random();
    setPops((p) => [...p.slice(-6), { id, x: r.x, y: r.y - 6, text, color }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
  };

  const setState = (i: number, s: NoteState) => {
    states.current[i] = s;
    staff.current?.setNoteState(i, s);
  };

  const stop = useCallback((cancel = false) => {
    cancelled.current = cancel;
    cancelAnimationFrame(raf.current);
    session.current?.stop();
    session.current = null;
    stopDemo();
    if (cancel) {
      collector.current.stop();
      audio.stopRecording();
      setPhase('idle');
      setCurrent(null);
      staff.current?.setCursor(null);
    }
  }, []);

  // ------------------------------------------------------------------ tempo
  const runTempo = async () => {
    const s = getSettings();
    const sess = await startSession({
      bpm,
      beatsPerBar: score.beatsPerBar,
      countInBars: ex.countInBars ?? 1,
      totalBeats: score.totalBeats,
      metronome,
      metronomeVolume: s.metronomeVolume,
      metronomeSound: s.metronomeSound,
      style: backing ? ex.style : undefined,
      chords: backing && ex.chords ? parseChordChart(ex.chords) : undefined,
      backingVolume: s.backingVolume,
      melody: guide ? score : undefined,
      melodyVolume: s.melodyVolume * 0.6,
      swingMelody: ex.swing,
      onBeat: (b) => {
        if (b < 0) setCount(-b <= score.beatsPerBar ? -b : 0);
        else setCount(0);
      },
    });
    session.current = sess;
    collector.current.start();
    audio.startRecording();
    setPhase('countdown');
    const lat = latencySec();
    const spb = 60 / bpm;
    const exp = score.notes.map((nt) => {
      const sb = ex.swing ? swingBeat(nt.beat) : nt.beat;
      const eb = ex.swing ? swingBeat(nt.beat + nt.beats) : nt.beat + nt.beats;
      return { t: sess.t0 + sb * spb, end: sess.t0 + eb * spb, midi: nt.midi };
    });
    const acc = exp.map(() => ({ hit: 0, other: 0, cents: [] as number[], firstT: 0 }));
    let judged = 0;
    let liveCombo = 0;
    let livePoints = 0;
    const endT = sess.t0 + score.totalBeats * spb + 0.6;
    const off = audio.onFrame((f) => {
      const tt = f.t - lat;
      for (let i = judged; i < exp.length; i++) {
        const e = exp[i];
        if (tt < e.t - tol.timingGood * 1.5) break;
        if (tt > e.end) continue;
        if (!f.voiced) continue;
        const w = concertToWritten(f.midi);
        if (Math.round(w) === e.midi) {
          if (!acc[i].hit) acc[i].firstT = tt;
          acc[i].hit++;
          acc[i].cents.push((w - e.midi) * 100);
        } else acc[i].other++;
      }
    });
    const loop = () => {
      const now = audio.now();
      const outLat = audio.latency().output;
      const beat = sess.timeToBeat(now - outLat);
      if (beat >= -0.05 && phaseRef.current !== 'running') {
        phaseRef.current = 'running';
        setPhase('running');
      }
      staff.current?.setCursor(beat >= 0 ? beat : null);
      // current note
      const ci = score.notes.findIndex((n) => beat >= n.beat - 0.05 && beat < n.beat + n.beats);
      setCurrent(ci >= 0 ? ci : null);
      // finalize judgments of passed notes
      while (judged < exp.length && now - lat > exp[judged].t + Math.min(exp[judged].end - exp[judged].t, 0.45) + 0.05) {
        const a = acc[judged];
        let j: NoteState;
        if (a.hit >= 3) {
          const mc = Math.abs(a.cents.reduce((x, y) => x + y, 0) / a.cents.length);
          const dt = Math.abs(a.firstT - exp[judged].t);
          j = mc <= tol.centsPerfect && dt <= tol.timingPerfect ? 'perfect' : mc <= tol.centsGood && dt <= tol.timingGood ? 'good' : 'ok';
        } else j = a.other >= 3 ? 'wrong' : 'miss';
        setState(judged, j);
        if (j === 'perfect' || j === 'good') liveCombo++;
        else if (j !== 'ok') liveCombo = 0;
        livePoints += JUDGMENT_POINTS[j as keyof typeof JUDGMENT_POINTS] * comboMultiplier(liveCombo);
        setCombo(liveCombo);
        setPoints(livePoints);
        addPop(judged, j!);
        if (j === 'perfect' && getSettings().sfx && liveCombo % 10 === 0 && liveCombo > 0) playSfx('combo');
        judged++;
      }
      if (now >= endT) {
        off();
        finishTempo(sess);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const phaseRef = useRef<Phase>('idle');

  const finishTempo = async (sess: Session) => {
    sess.stop();
    session.current = null;
    staff.current?.setCursor(null);
    const frames = collector.current.stop();
    if (cancelled.current) return;
    const result = evaluateSequence(score, frames, { t0: sess.t0, bpm, latency: latencySec(), checkArticulation: ex.check?.articulation, checkDynamics: ex.check?.dynamics, swing: ex.swing }, { ...tol, passScore: ctx.passScore ?? ex.passScore ?? tol.passScore });
    // show final judgments
    result.notes?.forEach((nr) => setState(nr.i, nr.judgment));
    result.metrics.tempoPercent = Math.round((100 * bpm) / baseBpm);
    if (bpm < baseBpm * 0.95 && result.passed && !ex.optional) {
      // slower than the target tempo: the attempt counts as practice but cannot pass
      result.passed = false;
      result.stars = 0;
      result.summary = `Хорошо! Теперь сыграйте в полном темпе (${baseBpm}), чтобы получить зачёт.`;
    }
    const fin = await saveAttempt(ex, ctx, result, `темп ${bpm}`);
    setPhase('idle');
    phaseRef.current = 'idle';
    onFinish(fin);
  };

  // ------------------------------------------------------------------ wait
  const runWait = async () => {
    await audio.ensureContext();
    collector.current.start();
    audio.startRecording();
    setPhase('running');
    phaseRef.current = 'running';
    const records: WaitNoteRecord[] = [];
    let i = 0;
    let since = audio.now();
    let hold: { start: number; cents: number[] } | null = null;
    let wrong: { midi: number; start: number; counted: boolean } | null = null;
    let wrongCount = 0;
    const startedAt = audio.now();
    setCurrent(0);
    setState(0, 'current');
    const advance = (skipped = false, cents: number[] = []) => {
      const meanC = cents.length ? cents.reduce((a, b) => a + b, 0) / cents.length : 0;
      const stdC = cents.length ? Math.sqrt(cents.reduce((a, b) => a + (b - meanC) ** 2, 0) / cents.length) : 0;
      records.push({ expected: score.notes[i].midi, reaction: audio.now() - since, wrongAttempts: wrongCount, cents: meanC, std: stdC, skipped });
      const j: NoteState = skipped ? 'miss' : wrongCount ? 'ok' : Math.abs(meanC) <= tol.centsPerfect ? 'perfect' : Math.abs(meanC) <= tol.centsGood ? 'good' : 'ok';
      setState(i, j);
      if (!skipped) playSfx(j === 'perfect' ? 'perfect' : 'hit');
      i++;
      wrongCount = 0;
      hold = null;
      wrong = null;
      since = audio.now();
      if (i >= score.notes.length) {
        off();
        skipRef.current = null;
        finishWait(records, audio.now() - startedAt);
        return;
      }
      // repeated same note: require a re-articulation (silence) – handled by needing a fresh hold
      setCurrent(i);
      setState(i, 'current');
    };
    skipRef.current = () => advance(true);
    let needRelease = false;
    const off = audio.onFrame((f) => {
      if (i >= score.notes.length) return;
      const target = score.notes[i].midi;
      if (!f.voiced) {
        hold = null;
        wrong = null;
        needRelease = false;
        return;
      }
      const w = concertToWritten(f.midi);
      if (Math.round(w) === target) {
        if (needRelease) return;
        if (!hold) hold = { start: f.t, cents: [] };
        hold.cents.push((w - target) * 100);
        if ((f.t - hold.start) * 1000 >= tol.holdMs) {
          const c = hold.cents;
          const nextSame = score.notes[i + 1]?.midi === target;
          advance(false, c);
          needRelease = nextSame;
        }
      } else {
        hold = null;
        if (!wrong || wrong.midi !== Math.round(w)) wrong = { midi: Math.round(w), start: f.t, counted: false };
        else if (!wrong.counted && f.t - wrong.start > 0.18) {
          wrong.counted = true;
          wrongCount++;
        }
      }
    });
  };
  const skipRef = useRef<(() => void) | null>(null);

  const finishWait = async (records: WaitNoteRecord[], seconds: number) => {
    collector.current.stop();
    const result = evaluateWait(records, { ...tol, passScore: ctx.passScore ?? ex.passScore ?? tol.passScore }, ctx.tier, seconds);
    if (modes[0] === 'tempo' && result.passed) {
      // wait mode is training: an exercise whose main mode is tempo passes only in tempo
      result.passed = false;
      result.stars = 0;
      result.summary = 'Ноты выучены! Теперь сыграйте в режиме «в темпе», чтобы получить зачёт.';
    }
    const fin = await saveAttempt(ex, ctx, result, 'ожидание');
    setPhase('idle');
    phaseRef.current = 'idle';
    setCurrent(null);
    onFinish(fin);
  };

  const start = async () => {
    if (phase !== 'idle') return;
    cancelled.current = false;
    stopDemo();
    staff.current?.clearStates();
    states.current = score.notes.map(() => null);
    setCombo(0);
    setPoints(0);
    if (mic.status !== 'on') await mic.retry();
    if (mode === 'tempo') await runTempo();
    else await runWait();
  };

  useKey(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'idle') start();
        else stop(true);
      } else if (e.code === 'Escape' && phase !== 'idle') stop(true);
      else if (e.code === 'KeyS' && mode === 'wait' && phase === 'running') skipRef.current?.();
      else if (e.code === 'KeyL' && phase === 'idle') playDemo({ kind: 'abc', abc: ex.abc, bpm, swing: ex.swing });
    },
    [phase, mode, bpm, metronome, backing, guide],
  );

  const curNote = current !== null ? score.notes[current] : score.notes[0];
  const timeToBeat = useCallback((t: number) => (session.current ? session.current.timeToBeat(t) : -100), []);
  const getBeat = useCallback(() => (session.current ? session.current.timeToBeat(audio.now() - audio.latency().output) : current !== null ? score.notes[current].beat : null), [current, score]);

  return (
    <div>
      <MicBanner {...mic} />
      <div className="player">
        <div className="player-main col" style={{ gap: 14 }}>
          <div className="stage">
            {phase === 'countdown' && count > 0 && <Countdown value={count} />}
            {view === 'staff' ? (
              <>
                <Staff ref={staff} abc={ex.abc} showNames={settings.showNoteNames && (ex.showNames ?? true)} showFingerings={settings.showFingerings} current={mode === 'wait' ? current : null} />
                <div className="overlay-layer">
                  {pops.map((p) => (
                    <div key={p.id} className="judge-pop" style={{ left: p.x + 12, top: p.y + 10, color: p.color }}>
                      {p.text}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <LaneView notes={score.notes} getBeat={getBeat} timeToBeat={timeToBeat} states={states} latency={latencySec()} />
            )}
          </div>
          <div className="card row wrap" style={{ gap: 16 }}>
            {phase === 'idle' ? (
              <button className="btn big" onClick={start} disabled={mic.status === 'error'}>
                <Play size={20} /> Начать <Kbd>Пробел</Kbd>
              </button>
            ) : (
              <button className="btn big danger" onClick={() => stop(true)}>
                <Square size={18} /> Стоп <Kbd>Esc</Kbd>
              </button>
            )}
            {phase === 'idle' && (
              <button className="btn ghost" onClick={() => playDemo({ kind: 'abc', abc: ex.abc, bpm, swing: ex.swing, style: backing ? ex.style : undefined, chords: ex.chords, metronome })}>
                <Volume2 size={18} /> Послушать образец <Kbd>L</Kbd>
              </button>
            )}
            {phase === 'running' && mode === 'wait' && (
              <button className="btn ghost" onClick={() => skipRef.current?.()}>
                <SkipForward size={18} /> Пропустить <Kbd>S</Kbd>
              </button>
            )}
            <div className="grow" />
            {mode === 'tempo' && (
              <div className="hud">
                <div className="center">
                  <div className="tiny muted">ОЧКИ</div>
                  <div className="big-num">{points}</div>
                </div>
                <div className="center">
                  <div className="tiny muted">КОМБО</div>
                  <div className={`combo ${combo ? 'bump' : ''}`} key={combo}>
                    ×{combo}
                  </div>
                </div>
              </div>
            )}
          </div>
          {phase === 'idle' && (
            <div className="card col" style={{ gap: 12 }}>
              <div className="row wrap" style={{ gap: 18 }}>
                {modes.length > 1 && (
                  <Seg
                    value={mode}
                    onChange={setMode}
                    options={modes.map((m) => [m, m === 'tempo' ? 'В темпе' : 'Ожидание'] as ['tempo' | 'wait', string])}
                  />
                )}
                <Seg value={view} onChange={setView} options={[['staff', 'Ноты'], ['lane', 'Дорожка']]} />
              </div>
              {mode === 'tempo' && (
                <div className="row wrap" style={{ gap: 18 }}>
                  <div className="row" style={{ minWidth: 300 }}>
                    <span className="small">Темп</span>
                    <input type="range" min={Math.round(baseBpm * 0.5)} max={Math.round(baseBpm * 1.3)} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                    <b style={{ whiteSpace: 'nowrap' }}>{bpm} уд/мин</b>
                  </div>
                  <Toggle on={metronome} onChange={setMetronome} label="Метроном" />
                  {ex.style && ex.style !== 'none' && <Toggle on={backing} onChange={setBacking} label={`Аккомпанемент (${STYLE_NAMES[ex.style]})`} />}
                  <Toggle on={guide} onChange={setGuide} label="Подыгрывать мелодию" />
                </div>
              )}
              <div className="small muted">
                {mode === 'tempo'
                  ? `Сначала прозвучит отсчёт в один такт. Зачёт — в темпе ${baseBpm} и быстрее; медленный темп — для тренировки.`
                  : 'Приложение ждёт, пока вы сыграете верную ноту, и только потом показывает следующую. Режим для разучивания — зачёт ставится в темпе.'}
              </div>
            </div>
          )}
        </div>
        <div className="col" style={{ gap: 14 }}>
          <LivePitch target={curNote?.midi} />
          <div className="card center">
            <div className="small muted">{phase === 'idle' ? 'Первая нота' : 'Сейчас'}</div>
            <div className="display" style={{ fontSize: 30, fontWeight: 800 }}>
              {curNote ? noteNameRu(curNote.midi) : '—'}
            </div>
            {curNote && <FingeringDiagram fingering={mainFingering(curNote.midi)} size={0.8} showLegend={false} />}
          </div>
        </div>
      </div>
    </div>
  );
}
