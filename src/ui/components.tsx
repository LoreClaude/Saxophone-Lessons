// Small reusable UI components.
import { useEffect, useMemo, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { mdToHtml } from '../lib/markdown';

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="row" style={{ cursor: 'pointer', gap: 10 }}>
      <div className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />
      {label && <span onClick={() => onChange(!on)}>{label}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="stars">
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < n ? 'on' : ''} fill={i < n ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

export function Bar({ value, className = '', thin }: { value: number; className?: string; thin?: boolean }) {
  return (
    <div className={`bar ${thin ? 'thin' : ''}`}>
      <div className={className} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ScoreRing({ score, size = 140, stroke = 12, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = useMemo(() => `rg${Math.random().toString(36).slice(2)}`, []);
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="val" style={{ fontSize: size * 0.26 }}>
        {Math.round(score)}
        <span style={{ fontSize: size * 0.12 }}>%</span>
      </div>
      {label && (
        <div className="muted small" style={{ position: 'absolute', bottom: -22 }}>
          {label}
        </div>
      )}
    </div>
  );
}

export function Markdown({ md, className = '' }: { md: string; className?: string }) {
  const html = useMemo(() => mdToHtml(md), [md]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={wide ? { width: 'min(980px, 94vw)' } : undefined}>
        {children}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export type MascotMood = 'happy' | 'cool' | 'wow' | 'think' | 'sad';

/** Бибоп — a jazz cat in sunglasses, the AI tutor. */
export function Mascot({ size = 96, mood = 'cool', float }: { size?: number; mood?: MascotMood; float?: boolean }) {
  const mouth =
    mood === 'wow' ? (
      <ellipse cx="60" cy="80" rx="6" ry="7" fill="#3a1a2a" />
    ) : mood === 'sad' ? (
      <path d="M50 84 Q60 76 70 84" stroke="#3a1a2a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    ) : mood === 'think' ? (
      <path d="M52 81 L68 79" stroke="#3a1a2a" strokeWidth="3.5" strokeLinecap="round" />
    ) : (
      <path d="M48 77 Q54 86 60 79 Q66 86 72 77" stroke="#3a1a2a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    );
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={float ? 'float' : ''} aria-label="Бибоп">
      <defs>
        <linearGradient id="bbfur" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb86b" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
      </defs>
      {/* beret */}
      <ellipse cx="62" cy="24" rx="30" ry="9" fill="var(--accent-2)" />
      <circle cx="62" cy="15" r="4" fill="var(--accent-2)" />
      {/* ears */}
      <path d="M22 44 L30 12 L50 34 Z" fill="url(#bbfur)" />
      <path d="M98 44 L90 12 L70 34 Z" fill="url(#bbfur)" />
      <path d="M28 38 L32 20 L44 34 Z" fill="#ffd6e6" />
      <path d="M92 38 L88 20 L76 34 Z" fill="#ffd6e6" />
      {/* head */}
      <ellipse cx="60" cy="64" rx="42" ry="38" fill="url(#bbfur)" />
      <ellipse cx="60" cy="78" rx="22" ry="15" fill="#fff1e0" />
      {/* sunglasses or eyes */}
      {mood === 'wow' || mood === 'sad' ? (
        <>
          <circle cx="44" cy="58" r="7" fill="#3a1a2a" />
          <circle cx="76" cy="58" r="7" fill="#3a1a2a" />
          <circle cx="46" cy="56" r="2.2" fill="#fff" />
          <circle cx="78" cy="56" r="2.2" fill="#fff" />
        </>
      ) : (
        <>
          <rect x="28" y="50" width="28" height="17" rx="8" fill="#1d1030" />
          <rect x="64" y="50" width="28" height="17" rx="8" fill="#1d1030" />
          <rect x="54" y="55" width="12" height="4" rx="2" fill="#1d1030" />
          <path d="M33 55 L43 55" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".8" />
          <path d="M69 55 L79 55" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        </>
      )}
      {/* nose */}
      <path d="M56 70 L64 70 L60 75 Z" fill="#ff5c8a" />
      {mouth}
      {/* whiskers */}
      <g stroke="#7a3a1a" strokeWidth="1.6" strokeLinecap="round" opacity=".7">
        <path d="M30 74 L12 70" />
        <path d="M30 79 L12 82" />
        <path d="M90 74 L108 70" />
        <path d="M90 79 L108 82" />
      </g>
    </svg>
  );
}

export function SaxIcon({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M40 6 L50 4 L52 8 L44 12" />
      <path d="M44 12 C40 14 38 18 38 24 L38 44 C38 54 30 58 22 56 C14 54 12 46 16 40 L20 34" />
      <path d="M14 36 L24 30 L26 36 L18 42 Z" fill={color} />
      <circle cx="38" cy="26" r="2" fill={color} />
      <circle cx="38" cy="34" r="2" fill={color} />
      <circle cx="38" cy="42" r="2" fill={color} />
    </svg>
  );
}

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card center col" style={{ alignItems: 'center', padding: 40 }}>
      {icon}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
