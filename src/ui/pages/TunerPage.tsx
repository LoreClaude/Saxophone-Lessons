import { useEffect, useRef, useState } from 'react';
import { audio } from '../../audio/engine';
import { concertToWritten, noteNameRu, octaveNameRu, midiToFreq } from '../../music/notes';
import { useSettings } from '../../store/settings';
import { cssVar } from '../../styles/themes';
import { navigate } from '../../lib/router';
import { Seg, Toggle } from '../components';
import { MicBanner, useMic, LevelMeter } from '../practice/common';

export function TunerPage() {
  const mic = useMic();
  const a4 = useSettings((s) => s.a4);
  const concert = useSettings((s) => s.tunerConcert);
  const set = useSettings((s) => s.set);
  const [st, setSt] = useState({ note: 0, cents: 0, hz: 0, voiced: false });
  const hist = useRef<{ t: number; c: number | null }[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let smooth = 0;
    const off = audio.onFrame((f) => {
      if (!f.voiced) {
        hist.current.push({ t: f.t, c: null });
        setSt((s) => ({ ...s, voiced: false }));
        return;
      }
      const m = concert ? f.midi : concertToWritten(f.midi);
      const note = Math.round(m);
      const cents = (m - note) * 100;
      smooth = smooth * 0.6 + cents * 0.4;
      hist.current.push({ t: f.t, c: cents });
      if (hist.current.length > 900) hist.current.splice(0, 300);
      setSt({ note, cents: smooth, hz: f.f0, voiced: true });
    });
    return off;
  }, [concert]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      if (c) {
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
        const now = audio.now();
        const span = 8;
        g.fillStyle = 'rgba(61,255,168,0.12)';
        g.fillRect(0, h / 2 - (10 / 50) * (h / 2), w, (20 / 50) * (h / 2));
        g.strokeStyle = cssVar('--border');
        g.beginPath();
        g.moveTo(0, h / 2);
        g.lineTo(w, h / 2);
        g.stroke();
        g.strokeStyle = cssVar('--accent');
        g.lineWidth = 2.5;
        g.beginPath();
        let first = true;
        for (const p of hist.current) {
          const x = w - ((now - p.t) / span) * w;
          if (x < 0) continue;
          if (p.c === null) {
            first = true;
            continue;
          }
          const y = h / 2 - Math.max(-50, Math.min(50, p.c)) * (h / 100);
          if (first) g.moveTo(x, y);
          else g.lineTo(x, y);
          first = false;
        }
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const c = Math.max(-50, Math.min(50, st.cents));
  const angle = (c / 50) * 60;
  const ok = st.voiced && Math.abs(st.cents) < 8;
  const color = !st.voiced ? 'var(--muted)' : ok ? 'var(--good)' : Math.abs(st.cents) < 20 ? 'var(--ok)' : 'var(--bad)';

  return (
    <div className="page">
      <h1>Тюнер</h1>
      <MicBanner {...mic} />
      <div className="card glow center" style={{ padding: 30 }}>
        <div className="tuner-dial">
          <svg viewBox="0 0 400 230" style={{ width: '100%' }}>
            {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((v) => {
              const a = ((v / 50) * 60 * Math.PI) / 180;
              const r1 = 170;
              const r2 = v % 50 === 0 || v === 0 ? 145 : 155;
              return (
                <line
                  key={v}
                  x1={200 + r1 * Math.sin(a)}
                  y1={210 - r1 * Math.cos(a)}
                  x2={200 + r2 * Math.sin(a)}
                  y2={210 - r2 * Math.cos(a)}
                  stroke={v === 0 ? 'var(--good)' : 'var(--muted)'}
                  strokeWidth={v === 0 ? 4 : 2}
                />
              );
            })}
            <path d="M 200 210 L 200 50" stroke={color} strokeWidth="5" strokeLinecap="round" style={{ transform: `rotate(${angle}deg)`, transformOrigin: '200px 210px', transition: 'transform .08s linear' }} />
            <circle cx="200" cy="210" r="10" fill={color} />
            <text x="40" y="225" fill="var(--muted)" fontSize="14">
              ниже
            </text>
            <text x="330" y="225" fill="var(--muted)" fontSize="14">
              выше
            </text>
          </svg>
        </div>
        <div className="tuner-note" style={{ color }}>
          {st.voiced ? noteNameRu(st.note) : '—'}
        </div>
        <div className="muted">
          {st.voiced ? `${octaveNameRu(st.note)} · ${st.cents > 0 ? '+' : ''}${Math.round(st.cents)} центов · ${st.hz.toFixed(1)} Гц` : 'Сыграйте ноту'}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          {concert ? 'Концертный строй (как на фортепиано)' : `Строй альт-саксофона${st.voiced ? ` · по фортепиано это ${noteNameRu(st.note - 9)}` : ''}`}
        </div>
        <canvas ref={canvas} style={{ width: '100%', height: 120, marginTop: 20 }} />
        <div className="tiny muted">Последние 8 секунд: зелёная полоса — точнее ±10 центов</div>
      </div>
      <div className="card mt row wrap" style={{ gap: 22 }}>
        <Toggle on={concert} onChange={(v) => set({ tunerConcert: v })} label="Концертный строй" />
        <div className="row">
          <span className="small">Камертон ля =</span>
          <Seg value={String(a4)} onChange={(v) => set({ a4: Number(v) })} options={[['440', '440'], ['441', '441'], ['442', '442'], ['443', '443']]} />
          <span className="small muted">Гц ({midiToFreq(69, a4).toFixed(0)})</span>
        </div>
        <div style={{ width: 160 }}>
          <LevelMeter />
        </div>
        <button className="btn ghost" onClick={() => navigate('/drone')}>
          Бурдон для строя
        </button>
      </div>
      <div className="card mt small muted">
        <b>Зачем «строй саксофона»?</b> Альт-саксофон — транспонирующий инструмент: когда вы нажимаете аппликатуру «До», звучит «Ми-бемоль» фортепиано. В нотах для
        саксофона пишут то, что вы нажимаете, поэтому тюнер по умолчанию показывает «саксофонную» ноту. Концертный строй нужен, когда вы играете с пианистом или
        гитаристом по их нотам.
      </div>
    </div>
  );
}
