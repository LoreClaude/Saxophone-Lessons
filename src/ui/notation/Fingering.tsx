// Saxophone fingering diagrams: a detailed one (with labelled groups of the
// extra keys) and a mini one for notes.
import { KEYS, type Fingering, type SaxKey, extraKeys } from '../../music/fingering';

/** Clear names of the extra keys as shown on the diagram. */
const EXTRA_LABEL: Partial<Record<SaxKey, string>> = {
  palmD: 'Ре',
  palmEb: 'Ми♭',
  palmF: 'Фа',
  frontF: 'Фа передний',
  Gs: 'Соль♯',
  lowCs: 'До♯ нижний',
  lowB: 'Си нижний',
  lowBb: 'Си♭ нижний',
  sideE: 'Ми высокий',
  sideC: 'До боковой',
  sideBb: 'Си♭ боковой',
  highFs: 'Фа♯ высокий',
  lowEb: 'Ми♭ нижний',
  lowC: 'До нижний',
};

interface Group {
  title: string;
  sub: string;
  x: number;
  y: number;
  keys: SaxKey[];
}

// viewBox 0 0 330 410: main stack in the middle, extra keys in labelled boxes.
const GROUPS: Group[] = [
  { title: 'ЛАДОНЬ', sub: 'левой руки', x: 6, y: 6, keys: ['palmD', 'palmEb', 'palmF'] },
  { title: 'МИЗИНЕЦ', sub: 'левой руки', x: 222, y: 100, keys: ['Gs', 'lowCs', 'lowB', 'lowBb'] },
  { title: 'БОКОВЫЕ', sub: 'ребро правой ладони', x: 222, y: 238, keys: ['sideE', 'sideC', 'sideBb', 'highFs'] },
  { title: 'МИЗИНЕЦ', sub: 'правой руки', x: 6, y: 300, keys: ['lowEb', 'lowC'] },
];
const BOX_W = 102;
const PILL_H = 20;
const PILL_GAP = 5;
const HEAD_H = 32;

const MAIN: { key: SaxKey; y: number; label: string }[] = [
  { key: 'B', y: 92, label: '1' },
  { key: 'A', y: 146, label: '2' },
  { key: 'G', y: 192, label: '3' },
  { key: 'F', y: 262, label: '4' },
  { key: 'E', y: 308, label: '5' },
  { key: 'D', y: 354, label: '6' },
];
const CX = 165;

export function FingeringDiagram({ fingering, size = 1, showLegend = true }: { fingering?: Fingering; size?: number; showLegend?: boolean }) {
  const on = new Set(fingering?.keys ?? []);
  const fillFor = (k: SaxKey) => (on.has(k) ? 'var(--accent)' : 'transparent');
  const strokeFor = (k: SaxKey) => (on.has(k) ? 'var(--accent)' : 'var(--muted)');
  const textFor = (k: SaxKey) => (on.has(k) ? '#fff' : 'var(--muted)');
  return (
    <svg width={330 * size * 0.8} height={410 * size * 0.8} viewBox="0 0 330 410" role="img" aria-label="Аппликатура">
      {/* body of the instrument */}
      <rect x={CX - 30} y={40} width={60} height={345} rx={30} fill="none" stroke="var(--border)" strokeWidth="2" />
      {/* front F above key 1 */}
      <g>
        <title>{KEYS.frontF.name} — {KEYS.frontF.finger}</title>
        <rect x={CX - 22} y={50} width={44} height={16} rx={8} fill={fillFor('frontF')} stroke={strokeFor('frontF')} strokeWidth="2" />
        <text x={CX} y={62} fontSize="10" fontWeight="700" textAnchor="middle" fill={textFor('frontF')}>
          Фа пер.
        </text>
      </g>
      {/* main six keys + bis */}
      {MAIN.map((m) => (
        <g key={m.key}>
          <title>{KEYS[m.key].name} — {KEYS[m.key].finger}</title>
          <circle cx={CX} cy={m.y} r={19} fill={fillFor(m.key)} stroke={strokeFor(m.key)} strokeWidth="2.5" style={on.has(m.key) ? { filter: 'drop-shadow(0 0 6px var(--glow))' } : undefined} />
          <text x={CX} y={m.y + 6} fontSize="17" fontWeight="800" textAnchor="middle" fill={textFor(m.key)}>
            {m.label}
          </text>
        </g>
      ))}
      <g>
        <title>{KEYS.bis.name} — {KEYS.bis.finger}</title>
        <circle cx={CX} cy={119} r={6} fill={fillFor('bis')} stroke={strokeFor('bis')} strokeWidth="2" />
        {on.has('bis') && (
          <text x={CX + 12} y={123} fontSize="10" fontWeight="700" fill="var(--accent)">
            бис
          </text>
        )}
      </g>
      {/* hands divider */}
      <line x1={CX - 38} y1={226} x2={CX + 38} y2={226} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={CX} y={221} fontSize="10" textAnchor="middle" fill="var(--muted)">
        левая рука ↑
      </text>
      <text x={CX} y={238} fontSize="10" textAnchor="middle" fill="var(--muted)">
        правая рука ↓
      </text>
      {/* octave key (left thumb) */}
      <g>
        <title>{KEYS.oct.name} — {KEYS.oct.finger}</title>
        <rect x={6} y={136} width={BOX_W} height={86} rx={12} fill="var(--surface)" stroke={on.has('oct') ? 'var(--accent)' : 'var(--border)'} />
        <text x={14} y={154} fontSize="11" fontWeight="800" fill="var(--text)">
          ОКТАВНЫЙ
        </text>
        <text x={14} y={167} fontSize="9.5" fill="var(--muted)">
          большой палец левой
        </text>
        <circle cx={57} cy={195} r={15} fill={fillFor('oct')} stroke={strokeFor('oct')} strokeWidth="2.5" />
        <text x={57} y={200} fontSize="14" fontWeight="800" textAnchor="middle" fill={textFor('oct')}>
          8
        </text>
      </g>
      {/* groups of extra keys */}
      {GROUPS.map((g) => {
        const h = HEAD_H + g.keys.length * (PILL_H + PILL_GAP) + 4;
        const active = g.keys.some((k) => on.has(k));
        return (
          <g key={g.title + g.sub}>
            <rect x={g.x} y={g.y} width={BOX_W} height={h} rx={12} fill="var(--surface)" stroke={active ? 'var(--accent)' : 'var(--border)'} />
            <text x={g.x + 8} y={g.y + 15} fontSize="11" fontWeight="800" fill="var(--text)">
              {g.title}
            </text>
            <text x={g.x + 8} y={g.y + 27} fontSize="9.5" fill="var(--muted)">
              {g.sub}
            </text>
            {g.keys.map((k, i) => {
              const y = g.y + HEAD_H + i * (PILL_H + PILL_GAP);
              return (
                <g key={k}>
                  <title>{KEYS[k].name} — {KEYS[k].finger}</title>
                  <rect x={g.x + 6} y={y} width={BOX_W - 12} height={PILL_H} rx={10} fill={fillFor(k)} stroke={strokeFor(k)} strokeWidth="1.8" />
                  <text x={g.x + BOX_W / 2} y={y + 14} fontSize="11" fontWeight="700" textAnchor="middle" fill={textFor(k)}>
                    {EXTRA_LABEL[k]}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
      {showLegend && (
        <text x={CX} y={402} fontSize="10" textAnchor="middle" fill="var(--muted)">
          закрашено — нажать
        </text>
      )}
    </svg>
  );
}

/** Plain-language list of everything to press besides the six main keys, one line per finger. */
export function extraKeyInstructions(f?: Fingering): string[] {
  if (!f) return [];
  const out: string[] = [];
  if (f.keys.includes('oct')) out.push('Большой палец левой руки — октавный клапан «8»');
  const byFinger = new Map<string, string[]>();
  for (const k of extraKeys(f)) {
    const finger = KEYS[k].finger;
    byFinger.set(finger, [...(byFinger.get(finger) ?? []), `«${EXTRA_LABEL[k] ?? KEYS[k].label}»`]);
  }
  for (const [finger, keys] of byFinger) {
    const who = finger.charAt(0).toUpperCase() + finger.slice(1);
    out.push(`${who} — ${keys.length > 1 ? 'клапаны' : 'клапан'} ${keys.join(', ')}`);
  }
  return out;
}

/** Text under a diagram: which main fingers and which extra keys. */
export function FingeringLegend({ fingering }: { fingering?: Fingering }) {
  if (!fingering) return null;
  const left = (['B', 'A', 'G'] as SaxKey[]).filter((k) => fingering.keys.includes(k)).map((k) => KEYS[k].label);
  const right = (['F', 'E', 'D'] as SaxKey[]).filter((k) => fingering.keys.includes(k)).map((k) => KEYS[k].label);
  const extra = extraKeyInstructions(fingering);
  return (
    <div className="small" style={{ textAlign: 'left', maxWidth: 300, margin: '0 auto' }}>
      <div>
        <b>Левая рука:</b> {left.length ? left.join(' ') : 'все пальцы подняты'}
      </div>
      <div>
        <b>Правая рука:</b> {right.length ? right.join(' ') : 'все пальцы подняты'}
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
