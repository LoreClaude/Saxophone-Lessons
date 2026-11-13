import { useEffect, useRef, useState } from 'react';
import { Play, Square, Minus, Plus, Hand } from 'lucide-react';
import { startSession, type Session } from '../../audio/backing';
import { useSettings } from '../../store/settings';
import { Seg, Toggle, Kbd } from '../components';
import { useKey } from '../practice/common';

const METERS: [string, string][] = [
  ['2', '2/4'],
  ['3', '3/4'],
  ['4', '4/4'],
  ['5', '5/4'],
  ['6', '6/8'],
];

const TEMPO_NAMES: [number, string][] = [
  [60, 'Largo — очень медленно'],
  [76, 'Adagio — медленно'],
  [108, 'Andante — неторопливо'],
  [120, 'Moderato — умеренно'],
  [156, 'Allegro — быстро'],
  [300, 'Presto — очень быстро'],
];

export function MetronomePage() {
  const s = useSettings();
  const [bpm, setBpm] = useState(80);
  const [meter, setMeter] = useState('4');
  const [sub, setSub] = useState('1');
  const [accent, setAccent] = useState(true);
  const [trainer, setTrainer] = useState(false);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const sess = useRef<Session | null>(null);
  const taps = useRef<number[]>([]);

  const beats = meter === '6' ? 2 : Number(meter);
  const start = async (tempo = bpm) => {
    sess.current?.stop();
    const sb = meter === '6' ? 3 : Number(sub);
    sess.current = await startSession({
      bpm: meter === '6' ? tempo : tempo,
      beatsPerBar: beats,
      countInBars: 0,
      totalBeats: Infinity,
      metronome: true,
      metronomeVolume: s.metronomeVolume,
      metronomeSound: s.metronomeSound,
      subdivision: sb,
      accentFirst: accent,
      onBeat: (b) => {
        setBeat(((b % beats) + beats) % beats);
        if (trainerRef.current && b > 0 && b % (beats * 4) === 0) {
          const nb = Math.min(240, bpmRef.current + 2);
          bpmRef.current = nb;
          setBpm(nb);
          setTimeout(() => start(nb), 0);
        }
      },
    });
    setRunning(true);
  };
  const stop = () => {
    sess.current?.stop();
    sess.current = null;
    setRunning(false);
    setBeat(-1);
  };
  const bpmRef = useRef(bpm);
  const trainerRef = useRef(trainer);
  useEffect(() => {
    bpmRef.current = bpm;
    trainerRef.current = trainer;
  }, [bpm, trainer]);
  useEffect(() => () => sess.current?.stop(), []);
  useEffect(() => {
    if (running) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meter, sub, accent]);

  const change = (v: number) => {
    const nb = Math.max(30, Math.min(240, v));
    setBpm(nb);
    if (running) {
      clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => start(nb), 250);
    }
  };
  const debounce = useRef(0);

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 2) {
      const d = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      change(Math.round(60000 / (d.reduce((a, b) => a + b, 0) / d.length)));
    }
  };

  useKey(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (running) stop();
        else start();
      } else if (e.code === 'ArrowUp') change(bpm + 1);
      else if (e.code === 'ArrowDown') change(bpm - 1);
      else if (e.code === 'KeyT') tap();
    },
    [running, bpm, meter, sub, accent],
  );

  const name = TEMPO_NAMES.find(([lim]) => bpm < lim)?.[1] ?? 'Presto';
  return (
    <div className="page">
      <h1>Метроном</h1>
      <div className="card glow center" style={{ padding: 30 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 14, marginBottom: 20 }}>
          {Array.from({ length: beats }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: beat === i ? (i === 0 && accent ? 'var(--accent)' : 'var(--accent-2)') : 'var(--surface-2)',
                boxShadow: beat === i ? '0 0 20px var(--glow)' : 'none',
                transition: 'background .05s',
              }}
            />
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 20 }}>
          <button className="btn ghost icon" onClick={() => change(bpm - 5)}>
            <Minus />
          </button>
          <div>
            <div className="display" style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>
              {bpm}
            </div>
            <div className="muted">ударов в минуту · {name}</div>
          </div>
          <button className="btn ghost icon" onClick={() => change(bpm + 5)}>
            <Plus />
          </button>
        </div>
        <input type="range" min={30} max={240} value={bpm} onChange={(e) => change(Number(e.target.value))} style={{ maxWidth: 520, marginTop: 20 }} />
        <div className="row mt" style={{ justifyContent: 'center' }}>
          {running ? (
            <button className="btn big danger" onClick={stop}>
              <Square size={18} /> Стоп <Kbd>Пробел</Kbd>
            </button>
          ) : (
            <button className="btn big" onClick={() => start()}>
              <Play size={20} /> Старт <Kbd>Пробел</Kbd>
            </button>
          )}
          <button className="btn ghost big" onClick={tap}>
            <Hand size={18} /> Тап-темп <Kbd>T</Kbd>
          </button>
        </div>
      </div>
      <div className="card mt col" style={{ gap: 14 }}>
        <div className="row wrap" style={{ gap: 20 }}>
          <div className="row">
            <span className="small">Размер</span>
            <Seg value={meter} onChange={setMeter} options={METERS} />
          </div>
          {meter !== '6' && (
            <div className="row">
              <span className="small">Доли</span>
              <Seg value={sub} onChange={setSub} options={[['1', '♩'], ['2', '♫'], ['3', 'триоли'], ['4', '16-е']]} />
            </div>
          )}
          <Toggle on={accent} onChange={setAccent} label="Акцент на первую долю" />
        </div>
        <Toggle on={trainer} onChange={setTrainer} label="Тренер темпа: +2 уд/мин каждые 4 такта" />
        <div className="tiny muted">
          Стрелки ↑/↓ меняют темп, T — тап-темп. Громкость и звук щелчка — в настройках.
        </div>
      </div>
    </div>
  );
}
