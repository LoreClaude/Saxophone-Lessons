// Saxophone fingering diagrams: a detailed one and a mini one for notes.
import { KEYS, type Fingering, type SaxKey, extraKeys } from '../../music/fingering';

interface KeyShape {
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
  label: string;
}

// Schematic layout (viewBox 0 0 200 360). Main stack in the middle column.
const SHAPES: Record<SaxKey, KeyShape> = {
  palmD: { x: 32, y: 34, w: 30, h: 16, label: 'Ре' },
  palmEb: { x: 32, y: 56, w: 30, h: 16, label: 'Ми♭' },
  palmF: { x: 32, y: 78, w: 30, h: 16, label: 'Фа' },
  frontF: { x: 100, y: 44, w: 26, h: 12, label: 'Ф' },
  oct: { x: 46, y: 132, r: 11, label: '8' },
  B: { x: 100, y: 78, r: 16, label: '1' },
  bis: { x: 100, y: 102, r: 6, label: '' },
  A: { x: 100, y: 128, r: 16, label: '2' },
  G: { x: 100, y: 170, r: 16, label: '3' },
  Gs: { x: 150, y: 160, w: 30, h: 14, label: 'Соль♯' },
  lowCs: { x: 150, y: 180, w: 30, h: 14, label: 'До♯' },
  lowB: { x: 150, y: 200, w: 30, h: 14, label: 'Си' },
  lowBb: { x: 150, y: 220, w: 30, h: 14, label: 'Си♭' },
  sideE: { x: 158, y: 250, w: 14, h: 22, label: 'Ми' },
  sideC: { x: 158, y: 276, w: 14, h: 22, label: 'До' },
  sideBb: { x: 158, y: 302, w: 14, h: 22, label: 'Си♭' },
  highFs: { x: 46, y: 262, w: 26, h: 14, label: 'Фа♯' },
  F: { x: 100, y: 236, r: 16, label: '4' },
  E: { x: 100, y: 278, r: 16, label: '5' },
  D: { x: 100, y: 320, r: 16, label: '6' },
  lowEb: { x: 52, y: 312, w: 30, h: 14, label: 'Ми♭' },
  lowC: { x: 52, y: 334, w: 30, h: 14, label: 'До' },
};

export function FingeringDiagram({ fingering, size = 1, showLegend = true }: { fingering?: Fingering; size?: number; showLegend?: boolean }) {
  const on = new Set(fingering?.keys ?? []);
  return (
    <svg width={200 * size} height={360 * size} viewBox="0 0 200 360" role="img" aria-label="Аппликатура">
      {/* body outline */}
      <rect x="76" y="20" width="48" height="330" rx="24" fill="none" stroke="var(--border)" strokeWidth="2" />
      <line x1="70" y1="203" x2="130" y2="203" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 4" />
      {showLegend && (
        <>
          <text x="4" y="16" fontSize="10" fill="var(--muted)">
            ладонь
          </text>
          <text x="156" y="148" fontSize="10" fill="var(--muted)" textAnchor="middle">
            мизинец
          </text>
          <text x="158" y="242" fontSize="10" fill="var(--muted)" textAnchor="middle">
            бок
          </text>
          <text x="46" y="155" fontSize="10" fill="var(--muted)" textAnchor="middle">
            большой
          </text>
          <text x="186" y="80" fontSize="11" fill="var(--muted)" textAnchor="end">
            Л
          </text>
          <text x="186" y="290" fontSize="11" fill="var(--muted)" textAnchor="end">
            П
          </text>
        </>
      )}
      {(Object.keys(SHAPES) as SaxKey[]).map((k) => {
        const s = SHAPES[k];
        const pressed = on.has(k);
        const fill = pressed ? 'var(--accent)' : 'transparent';
        const stroke = pressed ? 'var(--accent)' : 'var(--muted)';
        const txt = pressed ? '#fff' : 'var(--muted)';
        return (
          <g key={k}>
            <title>{KEYS[k].name}</title>
            {s.r ? (
              <circle cx={s.x} cy={s.y} r={s.r} fill={fill} stroke={stroke} strokeWidth="2.5" style={pressed ? { filter: 'drop-shadow(0 0 6px var(--glow))' } : undefined} />
            ) : (
              <rect
                x={s.x - (s.w ?? 20) / 2}
                y={s.y - (s.h ?? 12) / 2}
                width={s.w}
                height={s.h}
                rx={Math.min(s.w ?? 20, s.h ?? 12) / 2}
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
              />
            )}
            {s.label && (
              <text x={s.x} y={s.y + (s.r ? 5 : 3.5)} fontSize={s.r ? 13 : 9} fontWeight="700" fill={txt} textAnchor="middle">
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const SHORT: Partial<Record<SaxKey, string>> = {
  Gs: 'с♯',
  lowCs: 'до♯',
  lowB: 'си',
  lowBb: 'си♭',
  lowEb: 'ми♭',
  lowC: 'до',
  bis: 'бис',
  sideBb: 'бок',
  sideC: 'бок',
  sideE: 'бок',
  highFs: 'ф♯',
  palmD: 'Л',
  palmEb: 'Л',
  palmF: 'Л',
  frontF: 'ф',
};

/** Compact diagram: octave key + six main keys + short labels of extra keys. */
export function MiniFingering({ fingering, height = 64 }: { fingering?: Fingering; height?: number }) {
  const on = new Set(fingering?.keys ?? []);
  const extraList = fingering ? extraKeys(fingering) : [];
  const palm = extraList.filter((k) => k.startsWith('palm')).length;
  const labels = [...new Set(extraList.filter((k) => !k.startsWith('palm')).map((k) => SHORT[k] ?? ''))].filter(Boolean);
  if (palm) labels.unshift(`Л${palm}`);
  const vbH = labels.length ? 76 : 64;
  const k = height / 64;
  const dot = (cy: number, key: SaxKey) => (
    <circle cx={11} cy={cy} r={4} fill={on.has(key) ? 'var(--accent)' : 'none'} stroke={on.has(key) ? 'var(--accent)' : 'var(--muted)'} strokeWidth="1.4" />
  );
  return (
    <svg width={22 * k} height={vbH * k} viewBox={`0 0 22 ${vbH}`} aria-label="Аппликатура">
      <circle cx={11} cy={4} r={2.8} fill={on.has('oct') ? 'var(--accent-3)' : 'none'} stroke="var(--muted)" strokeWidth="1" />
      {dot(13, 'B')}
      {dot(22, 'A')}
      {dot(31, 'G')}
      <line x1="5" y1="36.5" x2="17" y2="36.5" stroke="var(--muted)" strokeWidth="1" />
      {dot(42, 'F')}
      {dot(51, 'E')}
      {dot(60, 'D')}
      {labels.length > 0 && (
        <text x={11} y={73} fontSize="7.5" textAnchor="middle" fill="var(--accent-3)" fontWeight="700">
          {labels.slice(0, 2).join(' ')}
        </text>
      )}
    </svg>
  );
}
