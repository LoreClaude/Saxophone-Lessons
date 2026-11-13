// Saxophone fingering diagrams: a drawing of the saxophone with every key in
// its place (like a printed fingering chart) and a mini one for notes.
import { useId } from 'react';
import { KEYS, type Fingering, type SaxKey, extraKeys } from '../../music/fingering';

type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'oval'; cx: number; cy: number; rx: number; ry: number; rot?: number };

/** Keys of the alto saxophone placed as on a printed fingering chart (viewBox 0 0 240 460), seen as the player sees the instrument. */
const KEY_SHAPES: Record<SaxKey, Shape> = {
  // left hand: three big keys with the small bis key between the first two
  B: { kind: 'circle', cx: 110, cy: 126, r: 13.5 },
  bis: { kind: 'circle', cx: 113, cy: 150, r: 5 },
  A: { kind: 'circle', cx: 110, cy: 173, r: 13.5 },
  G: { kind: 'circle', cx: 110, cy: 212, r: 13.5 },
  // right hand
  F: { kind: 'circle', cx: 110, cy: 284, r: 14.5 },
  E: { kind: 'circle', cx: 110, cy: 322, r: 14.5 },
  D: { kind: 'circle', cx: 110, cy: 360, r: 14.5 },
  // octave key (left thumb, on the back) and front F above the first key
  oct: { kind: 'oval', cx: 86, cy: 152, rx: 6, ry: 9.5 },
  frontF: { kind: 'oval', cx: 112, cy: 101, rx: 7, ry: 4.2, rot: 12 },
  // palm keys of the left hand: top left of the body
  palmD: { kind: 'oval', cx: 92, cy: 70, rx: 4.4, ry: 10, rot: -25 },
  palmEb: { kind: 'oval', cx: 81, cy: 82, rx: 4.4, ry: 10, rot: -25 },
  palmF: { kind: 'oval', cx: 80, cy: 102, rx: 4.4, ry: 8.5, rot: -40 },
  // left little finger table: left of the body, between the hands
  Gs: { kind: 'oval', cx: 81, cy: 231, rx: 11, ry: 5.2, rot: 8 },
  lowCs: { kind: 'oval', cx: 85, cy: 246, rx: 7.5, ry: 4.6 },
  lowB: { kind: 'oval', cx: 85, cy: 260, rx: 7.5, ry: 4.6 },
  lowBb: { kind: 'oval', cx: 68, cy: 253, rx: 7, ry: 4.6 },
  // side keys of the right hand: right of the lower keys, towards the bell
  sideE: { kind: 'oval', cx: 141, cy: 262, rx: 4.4, ry: 9.5, rot: 6 },
  sideC: { kind: 'oval', cx: 142, cy: 284, rx: 4.4, ry: 9.5, rot: 6 },
  sideBb: { kind: 'oval', cx: 143, cy: 306, rx: 4.4, ry: 9.5, rot: 6 },
  highFs: { kind: 'oval', cx: 144, cy: 337, rx: 4.4, ry: 8.5, rot: 6 },
  // right little finger: bottom right
  lowEb: { kind: 'oval', cx: 126, cy: 384, rx: 8.5, ry: 5, rot: 18 },
  lowC: { kind: 'oval', cx: 110, cy: 399, rx: 9.5, ry: 5.5, rot: 18 },
};

// Neck, body, bow and bell as one outline (no seams between the parts).
const SAX_OUTLINE = [
  'M 62 31 L 84 38.5 Q 101 38.5 101 60 L 101 80',
  'C 101 92 92.5 94 92.5 106 L 82 392',
  'A 58 58 0 0 0 198 392 C 200 352 212 314 224 284',
  'L 162 284 C 166 304 170 340 170 392 A 16 16 0 0 1 138 392',
  'L 127.5 106 C 127.5 94 119 92 119 80 L 119 58 Q 119 21 86 21 L 64 17 Z',
].join(' ');
const MOUTHPIECE = 'M 66 15.5 L 40 13 Q 29 13 27.5 19 L 36 25.5 L 66 32.5 Z';

function KeyShape({ k, on }: { k: SaxKey; on: boolean }) {
  const s = KEY_SHAPES[k];
  const paint = {
    fill: on ? 'var(--accent)' : 'var(--surface-solid)',
    stroke: on ? 'var(--accent)' : 'var(--muted)',
    strokeWidth: 2,
    style: { transition: 'fill .15s, stroke .15s', ...(on ? { filter: 'drop-shadow(0 0 5px var(--glow))' } : {}) },
  };
  return (
    <g>
      <title>{`${KEYS[k].name} — ${KEYS[k].finger}`}</title>
      {s.kind === 'circle' ? (
        <circle cx={s.cx} cy={s.cy} r={s.r} {...paint} />
      ) : (
        <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} {...paint} />
      )}
    </g>
  );
}

/** The saxophone with its keys; pressed keys are filled. No text on the drawing. */
export function FingeringDiagram({ fingering, size = 1 }: { fingering?: Fingering; size?: number }) {
  const on = new Set(fingering?.keys ?? []);
  const grad = `sax-body-${useId().replace(/:/g, '')}`;
  return (
    <svg width={240 * size * 0.8} height={460 * size * 0.8} viewBox="0 0 240 460" role="img" aria-label="Схема нажатия клапанов">
      <defs>
        <linearGradient id={grad} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--muted)" stopOpacity="0.12" />
          <stop offset="0.3" stopColor="var(--muted)" stopOpacity="0.3" />
          <stop offset="0.62" stopColor="var(--muted)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--muted)" stopOpacity="0.24" />
        </linearGradient>
      </defs>
      <path d={SAX_OUTLINE} fill={`url(#${grad})`} stroke="var(--muted)" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx={193} cy={284} rx={31} ry={6} fill="var(--surface-solid)" stroke="var(--muted)" strokeWidth="2" />
      <path d={MOUTHPIECE} fill="var(--muted)" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 50 14 L 50 29.2 M 55 14.4 L 55 30.4" stroke="var(--surface-solid)" strokeWidth="2.2" />
      {(Object.keys(KEY_SHAPES) as SaxKey[]).map((k) => (
        <KeyShape key={k} k={k} on={on.has(k)} />
      ))}
    </svg>
  );
}

const MAIN_FINGER: Partial<Record<SaxKey, string>> = {
  B: 'указательный',
  A: 'средний',
  G: 'безымянный',
  F: 'указательный',
  E: 'средний',
  D: 'безымянный',
};

const andList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} и ${xs[xs.length - 1]}` : xs.join(''));
const PALM_NOTE: Partial<Record<SaxKey, string>> = { palmD: 'ре', palmEb: 'ми-бемоль', palmF: 'фа' };

/** Plain-language list of everything to press besides the six big keys, one line per finger. */
export function extraKeyInstructions(f?: Fingering): string[] {
  if (!f) return [];
  const byFinger = new Map<string, SaxKey[]>();
  for (const k of [...(f.keys.includes('oct') ? (['oct'] as SaxKey[]) : []), ...extraKeys(f)]) {
    const finger = KEYS[k].finger;
    byFinger.set(finger, [...(byFinger.get(finger) ?? []), k]);
  }
  return [...byFinger].map(([finger, keys]) => {
    const palm = keys.filter((k) => PALM_NOTE[k]);
    const names = keys.filter((k) => !PALM_NOTE[k]).map((k) => KEYS[k].name.toLowerCase());
    if (palm.length) names.unshift(`${palm.length > 1 ? 'ладонные клапаны' : 'ладонный клапан'} ${andList(palm.map((k) => PALM_NOTE[k]!))}`);
    return `${finger.charAt(0).toUpperCase()}${finger.slice(1)} — ${andList(names)}`;
  });
}

/** Text under a diagram: which fingers press the big keys and which extra keys are needed. */
export function FingeringLegend({ fingering }: { fingering?: Fingering }) {
  if (!fingering) return null;
  const fingers = (keys: SaxKey[]) => andList(keys.filter((k) => fingering.keys.includes(k)).map((k) => MAIN_FINGER[k]!));
  const left = fingers(['B', 'A', 'G']);
  const right = fingers(['F', 'E', 'D']);
  const extra = extraKeyInstructions(fingering);
  return (
    <div className="small" style={{ textAlign: 'left', maxWidth: 300, margin: '0 auto' }}>
      <div>
        <b>Левая рука:</b> {left || 'пальцы подняты'}
      </div>
      <div>
        <b>Правая рука:</b> {right || 'пальцы подняты'}
      </div>
      {extra.length > 0 && (
        <>
          <div style={{ marginTop: 4 }}>
            <b>Дополнительно:</b>
          </div>
          <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
            {extra.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </>
      )}
    </div>
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
