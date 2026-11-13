// Small chart components for the progress page.
// Rules: one hue per single-series chart, thin marks (≤24px bars, 4px rounded
// data end, square at the baseline), solid hairline grid, hover tooltips plus a
// table view for every chart; diverging scale = blue ↔ red with a gray midpoint.
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../store/settings';
import { THEMES } from '../styles/themes';

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface Tip {
  x: number;
  y: number;
  value: string;
  label: string;
}

function TooltipBox({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: tip.x,
        top: tip.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        background: 'var(--surface-solid)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '6px 10px',
        pointerEvents: 'none',
        boxShadow: 'var(--shadow)',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      <div style={{ fontWeight: 700 }}>{tip.value}</div>
      <div className="tiny muted">{tip.label}</div>
    </div>
  );
}

export function TableToggle({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="tiny" style={{ marginTop: 8 }}>
      <summary className="muted" style={{ cursor: 'pointer' }}>
        Показать таблицей
      </summary>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
        <table className="md" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row between">
        <span className="small muted">{label}</span>
        {icon}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column chart (single series)
// ---------------------------------------------------------------------------

export function ColumnChart({ data, unit, height = 180, valueFmt = (v: number) => String(v) }: { data: { label: string; value: number }[]; unit: string; height?: number; valueFmt?: (v: number) => string }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const W = 640;
  const axisH = 22;
  const leftW = 34;
  const plotH = height - axisH;
  const band = (W - leftW) / Math.max(1, data.length);
  const barW = Math.min(24, band - 2);
  const maxIdx = data.findIndex((d) => d.value === max);
  const ticks = [0, nice / 2, nice];
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={`Столбчатая диаграмма, ${unit}`}>
        {ticks.map((t) => {
          const y = plotH - (t / nice) * (plotH - 14);
          return (
            <g key={t}>
              <line x1={leftW} x2={W} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={leftW - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {valueFmt(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / nice) * (plotH - 14);
          const x = leftW + i * band + (band - barW) / 2;
          const y = plotH - h;
          const r = Math.min(4, h / 2, barW / 2);
          return (
            <g
              key={i}
              onPointerMove={() => {
                const rect = wrap.current!.getBoundingClientRect();
                setHover(i);
                setTip({ x: ((x + barW / 2) / W) * rect.width, y: (Math.max(0, y) / height) * rect.height, value: `${valueFmt(d.value)} ${unit}`, label: d.label });
              }}
              onPointerLeave={() => {
                setHover(-1);
                setTip(null);
              }}
            >
              <rect x={leftW + i * band} y={0} width={band} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x} ${plotH} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + barW - r} ${y} Q${x + barW} ${y} ${x + barW} ${y + r} L${x + barW} ${plotH} Z`}
                  fill="var(--accent-2)"
                  opacity={hover === i ? 1 : 0.85}
                />
              )}
              {i === maxIdx && d.value > 0 && (
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="var(--text)">
                  {valueFmt(d.value)}
                </text>
              )}
              {(i % Math.ceil(data.length / 10) === 0 || i === data.length - 1) && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <TooltipBox tip={tip} />
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// ---------------------------------------------------------------------------
// Calendar heatmap (sequential, one hue)
// ---------------------------------------------------------------------------

export function CalendarHeatmap({ values, weeks = 20, unit = 'мин' }: { values: Record<string, number>; weeks?: number; unit?: string }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => {
    const out: { key: string; date: Date; v: number }[] = [];
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1) - ((today.getDay() + 6) % 7) + 6);
    // align to Monday
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ key, date: new Date(d), v: values[key] ?? 0 });
    }
    return out;
  }, [values, weeks]);
  const steps = [0, 5, 15, 30, 60];
  const level = (v: number) => (v <= 0 ? -1 : steps.filter((s) => v >= s).length - 1);
  const mix = [18, 38, 58, 78, 100];
  const size = 14;
  const gap = 3;
  const nW = Math.ceil(cells.length / 7);
  const W = 30 + nW * (size + gap);
  const H = 7 * (size + gap) + 18;
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W * 1.6, display: 'block' }} role="img" aria-label="Календарь занятий">
        {['Пн', 'Ср', 'Пт'].map((d, i) => (
          <text key={d} x={0} y={18 + (i * 2) * (size + gap) + size - 3} fontSize="10" fill="var(--muted)">
            {d}
          </text>
        ))}
        {cells.map((c, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const x = 30 + col * (size + gap);
          const y = 18 + row * (size + gap);
          const lv = level(c.v);
          const fill = lv < 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--accent-2) ${mix[lv]}%, var(--surface-solid))`;
          const showMonth = row === 0 && c.date.getDate() <= 7;
          return (
            <g key={c.key}>
              {showMonth && (
                <text x={x} y={10} fontSize="10" fill="var(--muted)">
                  {months[c.date.getMonth()]}
                </text>
              )}
              <rect
                x={x}
                y={y}
                width={size}
                height={size}
                rx={3}
                fill={fill}
                tabIndex={0}
                onPointerMove={() => {
                  const r = wrap.current!.getBoundingClientRect();
                  const svgW = Math.min(r.width, W * 1.6);
                  setTip({ x: ((x + size / 2) / W) * svgW, y: (y / H) * (svgW * (H / W)), value: `${Math.round(c.v)} ${unit}`, label: c.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }) });
                }}
                onPointerLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <div className="row tiny muted" style={{ gap: 6, marginTop: 4 }}>
        <span>меньше</span>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface-2)' }} />
        {mix.map((m) => (
          <span key={m} style={{ width: 12, height: 12, borderRadius: 3, background: `color-mix(in srgb, var(--accent-2) ${m}%, var(--surface-solid))` }} />
        ))}
        <span>больше (0 · 5 · 15 · 30 · 60+ мин)</span>
      </div>
      <TooltipBox tip={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meter list (one ratio per named row)
// ---------------------------------------------------------------------------

export function MeterList({ rows }: { rows: { name: string; value: number | null; hint?: string }[] }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {rows.map((r) => (
        <div key={r.name} className="row" style={{ gap: 12 }} title={r.hint}>
          <span className="small" style={{ width: 130 }}>
            {r.name}
          </span>
          <div className="grow" style={{ height: 10, borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 16%, var(--surface-solid))' }}>
            {r.value !== null && <div style={{ width: `${r.value}%`, height: '100%', borderRadius: 999, background: 'var(--accent)' }} />}
          </div>
          <span className="small" style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {r.value === null ? '—' : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diverging strip (intonation per note: flat ↔ sharp)
// ---------------------------------------------------------------------------

export function DivergingStrip({ items, limit = 40 }: { items: { label: string; value: number | null; n: number }[]; limit?: number }) {
  const theme = useSettings((s) => s.theme);
  const dark = THEMES[theme]?.dark ?? true;
  const cool = dark ? '#3987e5' : '#2a78d6';
  const warm = dark ? '#e5484d' : '#d03b3b';
  const mid = dark ? '#383835' : '#f0efec';
  const [tip, setTip] = useState<Tip | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const colorFor = (v: number | null) => {
    if (v === null) return 'transparent';
    const t = Math.max(-1, Math.min(1, v / limit));
    const pole = t < 0 ? cool : warm;
    return `color-mix(in srgb, ${pole} ${Math.round(Math.abs(t) * 100)}%, ${mid})`;
  };
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: 2 }}>
        {items.map((it, i) => (
          <div
            key={i}
            tabIndex={0}
            onPointerMove={(e) => {
              const r = wrap.current!.getBoundingClientRect();
              const cr = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setTip({
                x: cr.left - r.left + cr.width / 2,
                y: cr.top - r.top,
                value: it.value === null ? 'нет данных' : `${it.value > 0 ? '+' : ''}${Math.round(it.value)} центов`,
                label: `${it.label}${it.n ? ` · ${it.n} измерений` : ''}`,
              });
            }}
            onPointerLeave={() => setTip(null)}
            style={{ cursor: 'default' }}
          >
            <div style={{ height: 36, borderRadius: 4, background: colorFor(it.value), border: it.value === null ? '1px dashed var(--border)' : 'none' }} />
            <div className="tiny muted center" style={{ marginTop: 3, fontSize: 10 }}>
              {it.label}
            </div>
          </div>
        ))}
      </div>
      <div className="row tiny muted" style={{ gap: 8, marginTop: 6 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: cool }} /> занижено
        <span style={{ width: 12, height: 12, borderRadius: 3, background: mid, border: '1px solid var(--border)' }} /> точно
        <span style={{ width: 12, height: 12, borderRadius: 3, background: warm }} /> завышено (шкала ±{limit} центов)
      </div>
      <TooltipBox tip={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line chart (single series, 0..100)
// ---------------------------------------------------------------------------

export function LineChart({ data, height = 180, unit = '%' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 640;
  const axisH = 22;
  const leftW = 34;
  const plotH = height - axisH;
  const n = data.length;
  const X = (i: number) => leftW + (n <= 1 ? (W - leftW) / 2 : (i / (n - 1)) * (W - leftW - 12));
  const Y = (v: number) => plotH - (v / 100) * (plotH - 10);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(d.value)}`).join(' ');
  const last = data[n - 1];
  return (
    <div
      ref={wrap}
      style={{ position: 'relative' }}
      onPointerMove={(e) => {
        const r = wrap.current!.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        let best = 0;
        for (let i = 0; i < n; i++) if (Math.abs(X(i) - px) < Math.abs(X(best) - px)) best = i;
        setHover(n ? best : null);
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="График среднего балла">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={leftW} x2={W} y1={Y(t)} y2={Y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={leftW - 6} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {n > 0 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {n > 0 && <circle cx={X(n - 1)} cy={Y(last.value)} r={5} fill="var(--accent)" stroke="var(--surface-solid)" strokeWidth={2} />}
        {n > 0 && (
          <text x={X(n - 1) - 8} y={Y(last.value) - 10} textAnchor="end" fontSize="12" fill="var(--text)">
            {Math.round(last.value)}
            {unit}
          </text>
        )}
        {data.map((d, i) =>
          i % Math.ceil(n / 8) === 0 || i === n - 1 ? (
            <text key={i} x={X(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {d.label}
            </text>
          ) : null,
        )}
        {hover !== null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={0} y2={plotH} stroke="var(--muted)" strokeWidth={1} />
            <circle cx={X(hover)} cy={Y(data[hover].value)} r={5} fill="var(--accent)" stroke="var(--surface-solid)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && wrap.current && (
        <TooltipBox
          tip={{
            x: (X(hover) / W) * wrap.current.getBoundingClientRect().width,
            y: (Y(data[hover].value) / height) * wrap.current.getBoundingClientRect().height,
            value: `${Math.round(data[hover].value)}${unit}`,
            label: data[hover].label,
          }}
        />
      )}
    </div>
  );
}
