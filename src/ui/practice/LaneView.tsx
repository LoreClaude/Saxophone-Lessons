// "Дорожка": scrolling piano-roll view with the live pitch trace.
import { useEffect, useRef } from 'react';
import type { ScoreNote } from '../../music/abc';
import { audio } from '../../audio/engine';
import { concertToWritten, noteNameRu } from '../../music/notes';
import { cssVar } from '../../styles/themes';
import type { NoteState } from '../notation/Staff';

interface Props {
  notes: ScoreNote[];
  /** Returns the current beat (or null when not running). */
  getBeat: () => number | null;
  /** Converts an AudioContext time to a beat. */
  timeToBeat: (t: number) => number;
  states: React.MutableRefObject<NoteState[]>;
  latency: number;
  height?: number;
}

export function LaneView({ notes, getBeat, timeToBeat, states, latency, height = 300 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const trace = useRef<{ beat: number; midi: number }[]>([]);

  useEffect(() => {
    const off = audio.onFrame((f) => {
      if (!f.voiced) return;
      trace.current.push({ beat: timeToBeat(f.t - latency), midi: concertToWritten(f.midi) });
      if (trace.current.length > 600) trace.current.splice(0, 200);
    });
    return off;
  }, [timeToBeat, latency]);

  useEffect(() => {
    let raf = 0;
    const midis = notes.map((n) => n.midi);
    const lo = Math.min(...midis) - 3;
    const hi = Math.max(...midis) + 3;
    const draw = () => {
      const c = canvas.current;
      if (!c) return;
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
      const beat = getBeat() ?? -1;
      const pxPerBeat = 90;
      const playX = w * 0.25;
      const rowH = h / (hi - lo + 1);
      const y = (m: number) => (hi - m) * rowH;
      const accent = cssVar('--accent');
      const accent2 = cssVar('--accent-2');
      const good = cssVar('--good');
      const ok = cssVar('--ok');
      const bad = cssVar('--bad');
      const muted = cssVar('--muted');
      const text = cssVar('--text');
      // rows
      for (let m = lo; m <= hi; m++) {
        if ([1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12)) {
          g.fillStyle = 'rgba(128,128,128,0.06)';
          g.fillRect(0, y(m), w, rowH);
        }
      }
      // beat lines
      g.strokeStyle = 'rgba(128,128,128,0.18)';
      for (let b = Math.floor(beat - playX / pxPerBeat); b < beat + (w - playX) / pxPerBeat + 1; b++) {
        const x = playX + (b - beat) * pxPerBeat;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
      }
      // notes
      g.font = '600 12px Rubik, sans-serif';
      notes.forEach((n, i) => {
        const x = playX + (n.beat - beat) * pxPerBeat;
        const wN = Math.max(8, n.beats * pxPerBeat - 4);
        if (x + wN < 0 || x > w) return;
        const st = states.current[i];
        const col = st === 'perfect' || st === 'good' ? good : st === 'ok' ? ok : st === 'wrong' || st === 'miss' ? bad : st === 'current' ? accent : accent2;
        g.fillStyle = col;
        g.globalAlpha = st ? 0.95 : 0.55;
        const yy = y(n.midi) + 2;
        roundRect(g, x, yy, wN, rowH - 4, Math.min(8, rowH / 2));
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = text;
        if (rowH >= 12) g.fillText(noteNameRu(n.midi), x + 6, yy + rowH / 2 + 2);
      });
      // trace
      g.strokeStyle = text;
      g.lineWidth = 3;
      g.beginPath();
      let started = false;
      let lastBeat = -1e9;
      for (const p of trace.current) {
        const x = playX + (p.beat - beat) * pxPerBeat;
        if (x < -10 || x > playX + 4) continue;
        const yy = y(p.midi) + rowH / 2;
        if (!started || p.beat - lastBeat > 0.15) {
          g.moveTo(x, yy);
          started = true;
        } else g.lineTo(x, yy);
        lastBeat = p.beat;
      }
      g.stroke();
      // playhead
      g.strokeStyle = accent;
      g.lineWidth = 3;
      g.shadowColor = accent;
      g.shadowBlur = 12;
      g.beginPath();
      g.moveTo(playX, 0);
      g.lineTo(playX, h);
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = muted;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [notes, getBeat, states]);

  return <canvas ref={canvas} style={{ width: '100%', height, display: 'block' }} />;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
