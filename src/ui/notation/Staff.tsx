// Sheet music rendering (abcjs) with overlays: Russian note names, mini
// fingering diagrams, per-note highlighting and a moving cursor.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import abcjs from 'abcjs';
import { parseScore, type Score } from '../../music/abc';
import { noteNameRu } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { MiniFingering } from './Fingering';
import { cssVar } from '../../styles/themes';
import { useSettings } from '../../store/settings';

export type NoteState = 'current' | 'perfect' | 'good' | 'ok' | 'wrong' | 'miss' | null;

export interface StaffHandle {
  setNoteState(i: number, s: NoteState): void;
  clearStates(): void;
  /** Cursor position in beats (null hides it). */
  setCursor(beat: number | null): void;
  /** Position of note i relative to the staff container. */
  noteRect(i: number): { x: number; y: number; w: number; h: number } | null;
  score: Score | null;
}

interface Props {
  abc: string;
  showNames?: boolean;
  showFingerings?: boolean;
  scale?: number;
  /** Highlight the note under this index as current. */
  current?: number | null;
  compact?: boolean;
  onReady?: (score: Score) => void;
}

interface NotePos {
  x: number;
  y: number;
  w: number;
  h: number;
  staffTop: number;
  staffBottom: number;
}

const STATE_VAR: Record<Exclude<NoteState, null>, string> = {
  current: '--accent',
  perfect: '--good',
  good: '--good',
  ok: '--ok',
  wrong: '--bad',
  miss: '--bad',
};

export const Staff = forwardRef<StaffHandle, Props>(function Staff(
  { abc, showNames = false, showFingerings = false, scale = 1.25, current = null, compact = false, onReady },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const elemsRef = useRef<SVGElement[][]>([]);
  const statesRef = useRef<NoteState[]>([]);
  const [positions, setPositions] = useState<NotePos[]>([]);
  const [width, setWidth] = useState(800);
  const theme = useSettings((s) => s.theme);

  const score = useMemo(() => {
    try {
      return parseScore(abc);
    } catch {
      return null;
    }
  }, [abc]);

  useLayoutEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (Math.abs(w - width) > 8) setWidth(w);
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [width]);

  const paint = (i: number) => {
    const els = elemsRef.current[i] ?? [];
    const st = statesRef.current[i];
    const color = st ? cssVar(STATE_VAR[st]) : '';
    for (const el of els) {
      el.querySelectorAll?.('path')?.forEach((p) => {
        (p as SVGElement).style.fill = color;
        (p as SVGElement).style.stroke = color;
      });
      el.style.fill = color;
      el.style.stroke = color;
      el.style.filter = st === 'current' ? `drop-shadow(0 0 6px ${cssVar('--accent')})` : '';
    }
  };

  // Render with abcjs
  useEffect(() => {
    if (!host.current || !score) return;
    const ink = cssVar('--staff-ink') || '#000';
    const staffwidth = Math.max(320, (width - 40) / scale);
    const topPad = showFingerings ? 86 : 18;
    const visual = (abcjs as any).renderAbc(host.current, abc, {
      add_classes: true,
      staffwidth,
      scale,
      foregroundColor: ink,
      paddingtop: topPad,
      paddingbottom: showNames ? 34 : 14,
      paddingleft: 4,
      paddingright: 4,
      format: {
        titlefont: 'Rubik 18',
        gchordfont: 'Rubik 13 bold',
        annotationfont: 'Rubik 12',
        staffsep: showFingerings ? 150 : showNames ? 70 : 50,
      },
    })[0];
    // map notes → SVG elements
    const elems: SVGElement[][] = score.notes.map((nt) => {
      const out: SVGElement[] = [];
      for (const ch of [nt.startChar, ...nt.tieChars]) {
        const el = visual?.getElementFromChar?.(ch);
        const set = el?.abselem?.elemset as SVGElement[] | undefined;
        if (set) out.push(...set);
      }
      return out;
    });
    elemsRef.current = elems;
    statesRef.current = score.notes.map(() => null);
    // compute positions
    const wrapRect = host.current.getBoundingClientRect();
    const staffs = Array.from(host.current.querySelectorAll('.abcjs-staff')) as SVGGraphicsElement[];
    const staffBoxes = staffs.map((s) => s.getBoundingClientRect());
    const pos: NotePos[] = elems.map((els) => {
      const head = els.find((e) => (e.getAttribute('class') ?? '').includes('abcjs-note')) ?? els[0];
      if (!head) return { x: 0, y: 0, w: 0, h: 0, staffTop: 0, staffBottom: 0 };
      const r = head.getBoundingClientRect();
      const lineMatch = /abcjs-l(\d+)/.exec(head.getAttribute('class') ?? '');
      const line = lineMatch ? Number(lineMatch[1]) : 0;
      const sb = staffBoxes[line] ?? r;
      return {
        x: r.left - wrapRect.left + r.width / 2,
        y: r.top - wrapRect.top,
        w: r.width,
        h: r.height,
        staffTop: sb.top - wrapRect.top,
        staffBottom: sb.bottom - wrapRect.top,
      };
    });
    setPositions(pos);
    onReady?.(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abc, width, scale, showFingerings, showNames, theme, score]);

  useEffect(() => {
    if (current === null || current === undefined) return;
    statesRef.current.forEach((s, i) => {
      if (s === 'current' && i !== current) {
        statesRef.current[i] = null;
        paint(i);
      }
    });
    if (statesRef.current[current] === null || statesRef.current[current] === undefined) {
      statesRef.current[current] = 'current';
      paint(current);
    }
  }, [current, positions]);

  useImperativeHandle(
    ref,
    () => ({
      score,
      setNoteState(i, s) {
        if (i < 0 || i >= statesRef.current.length) return;
        statesRef.current[i] = s;
        paint(i);
      },
      clearStates() {
        statesRef.current = statesRef.current.map(() => null);
        statesRef.current.forEach((_, i) => paint(i));
      },
      setCursor(beat) {
        const c = cursorRef.current;
        if (!c || !score) return;
        if (beat === null || !positions.length) {
          c.style.display = 'none';
          return;
        }
        const notes = score.notes;
        let i = notes.findIndex((n) => n.beat > beat) - 1;
        if (i === -2) i = notes.length - 1;
        if (i < 0) i = 0;
        const a = positions[i];
        const nb = notes[i + 1];
        const b = nb ? positions[i + 1] : null;
        let x = a.x;
        if (b && b.staffTop === a.staffTop && nb.beat > notes[i].beat) {
          const t = Math.max(0, Math.min(1, (beat - notes[i].beat) / (nb.beat - notes[i].beat)));
          x = a.x + (b.x - a.x) * t;
        }
        c.style.display = 'block';
        c.style.left = `${x}px`;
        c.style.top = `${a.staffTop - 10}px`;
        c.style.height = `${a.staffBottom - a.staffTop + 20}px`;
      },
      noteRect(i) {
        const p = positions[i];
        return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
      },
    }),
    [score, positions],
  );

  if (!score) return <div className="card muted">Не удалось прочитать ноты.</div>;

  return (
    <div className="staff-wrap" ref={wrap} style={compact ? { padding: 4 } : undefined}>
      <div ref={host} />
      <div className="overlay-layer">
        {showNames &&
          positions.map((p, i) => (
            <div
              key={`n${i}`}
              className={`note-name ${current === i ? 'cur' : ''}`}
              style={{ left: p.x, top: Math.max(p.staffBottom, p.y + p.h) + 4 }}
            >
              {noteNameRu(score.notes[i].midi)}
            </div>
          ))}
        {showFingerings &&
          positions.map((p, i) =>
            i > 0 && score.notes[i].midi === score.notes[i - 1].midi && positions[i - 1].staffTop === p.staffTop ? null : (
              <div key={`f${i}`} style={{ position: 'absolute', left: p.x - 9, top: p.staffTop - 80 }}>
                <MiniFingering fingering={mainFingering(score.notes[i].midi)} height={52} />
              </div>
            ),
          )}
        <div ref={cursorRef} className="cursor-line" style={{ display: 'none' }} />
      </div>
    </div>
  );
});
