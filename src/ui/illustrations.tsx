// Animated schematic illustrations for lessons ("видео-схемы").
import type { IllustrationId } from '../content/types';
import { Staff } from './notation/Staff';

const ink = 'var(--text)';
const muted = 'var(--muted)';
const acc = 'var(--accent)';
const acc2 = 'var(--accent-2)';
const acc3 = 'var(--accent-3)';

const css = `
@keyframes ill-breath { 0%,100% { transform: scale(1,1); } 45%,55% { transform: scale(1.18,1.12); } }
@keyframes ill-diaphragm { 0%,100% { transform: translateY(0); } 45%,55% { transform: translateY(14px); } }
@keyframes ill-in { 0%,40% { opacity: 1; } 50%,100% { opacity: 0; } }
@keyframes ill-out { 0%,45% { opacity: 0; } 55%,95% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ill-flow { to { stroke-dashoffset: -40; } }
@keyframes ill-tongue { 0%,30%,100% { transform: translateX(0); } 40%,90% { transform: translateX(-16px); } }
@keyframes ill-wave { to { transform: translateX(-80px); } }
@keyframes ill-blink { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes ill-swing { 0% { transform: translateX(0); } 100% { transform: translateX(480px); } }
`;

function Frame({ children, h = 260, caption }: { children: React.ReactNode; h?: number; caption?: string }) {
  return (
    <figure className="card" style={{ margin: 0, padding: 16 }}>
      <style>{css}</style>
      <svg viewBox={`0 0 520 ${h}`} style={{ width: '100%', maxHeight: h + 40 }}>
        {children}
      </svg>
      {caption && <figcaption className="small muted center">{caption}</figcaption>}
    </figure>
  );
}

function Breathing({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption}>
      {/* torso silhouette */}
      <circle cx="160" cy="46" r="30" fill="none" stroke={ink} strokeWidth="3" />
      <path d="M120 230 L120 110 Q120 84 160 84 Q200 84 200 110 L200 230" fill="none" stroke={ink} strokeWidth="3" />
      {/* lungs */}
      <ellipse cx="143" cy="128" rx="16" ry="26" fill={acc2} opacity=".25" style={{ transformOrigin: '143px 128px', animation: 'ill-breath 6s ease-in-out infinite' }} />
      <ellipse cx="177" cy="128" rx="16" ry="26" fill={acc2} opacity=".25" style={{ transformOrigin: '177px 128px', animation: 'ill-breath 6s ease-in-out infinite' }} />
      {/* diaphragm */}
      <path d="M124 158 Q160 136 196 158" fill="none" stroke={acc} strokeWidth="4" style={{ animation: 'ill-diaphragm 6s ease-in-out infinite' }} />
      {/* belly */}
      <ellipse cx="160" cy="196" rx="34" ry="26" fill={acc} opacity=".3" style={{ transformOrigin: '160px 196px', animation: 'ill-breath 6s ease-in-out infinite' }} />
      {/* air arrows */}
      <g style={{ animation: 'ill-in 6s linear infinite' }}>
        <path d="M250 60 L200 60" stroke={acc2} strokeWidth="4" markerEnd="url(#arr)" />
        <text x="262" y="66" fill={acc2} fontSize="20" fontWeight="700">
          вдох
        </text>
      </g>
      <g style={{ animation: 'ill-out 6s linear infinite' }}>
        <path d="M200 70 L250 70" stroke={acc} strokeWidth="4" markerEnd="url(#arr2)" />
        <text x="262" y="76" fill={acc} fontSize="20" fontWeight="700">
          выдох «ссс»
        </text>
      </g>
      <defs>
        <marker id="arr" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={acc2} />
        </marker>
        <marker id="arr2" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill={acc} />
        </marker>
      </defs>
      <text x="262" y="150" fill={ink} fontSize="15">
        • Диафрагма опускается
      </text>
      <text x="262" y="174" fill={ink} fontSize="15">
        • Живот и нижние рёбра расширяются
      </text>
      <text x="262" y="198" fill={ink} fontSize="15">
        • Плечи неподвижны
      </text>
      <text x="262" y="222" fill={muted} fontSize="13">
        Цикл: вдох 1 с · выдох ровно, с опорой
      </text>
    </Frame>
  );
}

function Embouchure({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption} h={250}>
      {/* mouthpiece body */}
      <path d="M150 96 L460 70 L460 150 L150 128 Z" fill={acc2} opacity=".25" stroke={acc2} strokeWidth="2" />
      {/* reed */}
      <path d="M150 130 L420 146" stroke={acc3} strokeWidth="6" strokeLinecap="round" />
      {/* ligature */}
      <rect x="330" y="64" width="40" height="92" rx="8" fill="none" stroke={muted} strokeWidth="3" />
      {/* upper teeth */}
      <rect x="168" y="80" width="26" height="16" rx="3" fill="#fff" stroke={muted} />
      {/* upper lip */}
      <path d="M120 66 Q170 60 210 84 Q170 78 130 84 Z" fill="#ff8fab" />
      {/* lower lip over teeth */}
      <rect x="166" y="150" width="26" height="18" rx="3" fill="#fff" stroke={muted} />
      <path d="M128 176 Q150 134 196 138 Q210 140 214 150 Q190 160 170 170 Q150 182 128 182 Z" fill="#ff8fab" />
      {/* air flow */}
      <path d="M60 112 L440 110" stroke={acc} strokeWidth="3" strokeDasharray="10 10" style={{ animation: 'ill-flow 1s linear infinite' }} />
      <text x="40" y="104" fill={acc} fontSize="14" fontWeight="700">
        воздух
      </text>
      {/* labels */}
      <text x="190" y="40" fill={ink} fontSize="14">
        верхние зубы на мундштуке
      </text>
      <path d="M200 46 L184 78" stroke={muted} />
      <text x="40" y="222" fill={ink} fontSize="14">
        нижняя губа прикрывает зубы
      </text>
      <path d="M150 208 L170 176" stroke={muted} />
      <text x="300" y="196" fill={ink} fontSize="14">
        трость
      </text>
      <path d="M318 182 L320 145" stroke={muted} />
      <text x="390" y="50" fill={ink} fontSize="14">
        мундштук
      </text>
      <text x="300" y="232" fill={muted} fontSize="13">
        Уголки губ собраны, подбородок ровный
      </text>
    </Frame>
  );
}

function Posture({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption} h={280}>
      <circle cx="200" cy="50" r="28" fill="none" stroke={ink} strokeWidth="3" />
      <path d="M200 78 L200 200 M200 110 L160 160 L190 186 M200 110 L236 150 L214 186 M200 200 L176 270 M200 200 L224 270" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* strap */}
      <path d="M186 80 Q200 96 214 80" stroke={acc3} strokeWidth="3" fill="none" />
      <path d="M200 92 L200 120" stroke={acc3} strokeWidth="2" strokeDasharray="4 3" />
      {/* sax */}
      <path d="M222 62 L232 70 L232 118 Q232 132 222 140 L210 220 Q206 246 186 246 Q168 244 170 226 L176 210" stroke={acc} strokeWidth="9" fill="none" strokeLinecap="round" />
      <text x="270" y="56" fill={ink} fontSize="15">
        Голова прямо — мундштук приходит ко рту
      </text>
      <text x="270" y="100" fill={acc3} fontSize="15">
        Гайтан держит вес инструмента
      </text>
      <text x="270" y="144" fill={ink} fontSize="15">
        Плечи опущены и свободны
      </text>
      <text x="270" y="188" fill={ink} fontSize="15">
        Левая рука сверху, правая снизу
      </text>
      <text x="270" y="232" fill={muted} fontSize="14">
        Сидя — саксофон сбоку или перед собой
      </text>
    </Frame>
  );
}

function Tonguing({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption} h={220}>
      <path d="M240 90 L480 70 L480 140 L240 122 Z" fill={acc2} opacity=".25" stroke={acc2} strokeWidth="2" />
      <path d="M240 124 L460 138" stroke={acc3} strokeWidth="6" strokeLinecap="round" />
      <path d="M60 160 Q120 110 190 128 Q228 134 238 128" stroke="#ff8fab" strokeWidth="18" fill="none" strokeLinecap="round" style={{ animation: 'ill-tongue 1.2s ease-in-out infinite' }} />
      <text x="60" y="60" fill={ink} fontSize="16">
        Кончик языка касается кончика трости
      </text>
      <text x="300" y="190" fill={acc} fontSize="30" fontWeight="800" style={{ animation: 'ill-blink 1.2s ease-in-out infinite' }}>
        ту · ту · ту
      </text>
      <text x="60" y="200" fill={muted} fontSize="13">
        Воздух идёт непрерывно
      </text>
    </Frame>
  );
}

function Octave({ caption }: { caption?: string }) {
  const wave = (y: number, len: number, color: string) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 560; x += 4) d += ` L${x} ${y + 16 * Math.sin((2 * Math.PI * x) / len)}`;
    return <path d={d} stroke={color} strokeWidth="3" fill="none" style={{ animation: 'ill-wave 2s linear infinite' }} />;
  };
  return (
    <Frame caption={caption} h={230}>
      <text x="20" y="28" fill={ink} fontSize="15">
        Без октавного клапана: звучит основной тон
      </text>
      <rect x="20" y="40" width="480" height="56" rx="28" fill="none" stroke={muted} strokeWidth="2" />
      <clipPath id="t1">
        <rect x="22" y="42" width="476" height="52" rx="26" />
      </clipPath>
      <g clipPath="url(#t1)">{wave(68, 320, acc2)}</g>
      <text x="20" y="136" fill={ink} fontSize="15">
        С октавным клапаном: волна делится — звук на октаву выше
      </text>
      <rect x="20" y="148" width="480" height="56" rx="28" fill="none" stroke={muted} strokeWidth="2" />
      <circle cx="130" cy="148" r="7" fill={acc} />
      <clipPath id="t2">
        <rect x="22" y="150" width="476" height="52" rx="26" />
      </clipPath>
      <g clipPath="url(#t2)">{wave(176, 160, acc)}</g>
    </Frame>
  );
}

function Vibrato({ caption }: { caption?: string }) {
  let d = 'M20 110';
  for (let x = 20; x <= 500; x += 3) d += ` L${x} ${110 + 26 * Math.sin((2 * Math.PI * (x - 20)) / 80) * Math.min(1, (x - 20) / 120)}`;
  return (
    <Frame caption={caption} h={200}>
      <line x1="20" y1="110" x2="500" y2="110" stroke={muted} strokeDasharray="6 6" />
      <path d={d} stroke={acc} strokeWidth="4" fill="none" />
      <path d="M340 70 L340 150" stroke={acc2} strokeWidth="2" />
      <text x="348" y="68" fill={acc2} fontSize="14">
        глубина (±20–30 центов)
      </text>
      <path d="M260 160 L340 160" stroke={acc3} strokeWidth="2" />
      <text x="230" y="186" fill={acc3} fontSize="14">
        одна волна ≈ 0,2 с (≈5 в секунду)
      </text>
      <text x="20" y="40" fill={ink} fontSize="15">
        Вибрато — плавное колебание высоты вокруг ноты (движение челюсти «я-я-я»)
      </text>
    </Frame>
  );
}

function Dynamics({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption} h={180}>
      <path d="M40 90 L240 50 M40 90 L240 130" stroke={acc} strokeWidth="4" fill="none" />
      <path d="M280 50 L480 90 M280 130 L480 90" stroke={acc2} strokeWidth="4" fill="none" />
      <text x="30" y="160" fill={ink} fontSize="22" fontStyle="italic" fontWeight="700">
        p
      </text>
      <text x="220" y="160" fill={ink} fontSize="22" fontStyle="italic" fontWeight="700">
        f
      </text>
      <text x="470" y="160" fill={ink} fontSize="22" fontStyle="italic" fontWeight="700">
        p
      </text>
      <text x="60" y="30" fill={acc} fontSize="15">
        крещендо — громче
      </text>
      <text x="300" y="30" fill={acc2} fontSize="15">
        диминуэндо — тише
      </text>
    </Frame>
  );
}

function Blues({ caption }: { caption?: string }) {
  const chords = ['G7', 'C7', 'G7', 'G7', 'C7', 'C7', 'G7', 'G7', 'D7', 'C7', 'G7', 'D7'];
  const deg = ['I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];
  return (
    <Frame caption={caption} h={230}>
      {chords.map((c, i) => {
        const x = 20 + (i % 4) * 122;
        const y = 20 + Math.floor(i / 4) * 68;
        const color = deg[i] === 'I' ? acc : deg[i] === 'IV' ? acc2 : acc3;
        return (
          <g key={i}>
            <rect x={x} y={y} width="112" height="58" rx="12" fill={color} opacity=".18" stroke={color} />
            <text x={x + 56} y={y + 28} fill={ink} fontSize="20" fontWeight="800" textAnchor="middle">
              {c}
            </text>
            <text x={x + 56} y={y + 48} fill={muted} fontSize="13" textAnchor="middle">
              такт {i + 1} · {deg[i]}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function Swing({ caption }: { caption?: string }) {
  const straight = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 40 + i * 60);
  const swing = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 40 + Math.floor(i / 2) * 120 + (i % 2 ? 80 : 0));
  return (
    <Frame caption={caption} h={200}>
      <text x="20" y="34" fill={ink} fontSize="15">
        Ровные восьмые: «та-та-та-та»
      </text>
      {straight.map((x, i) => (
        <circle key={i} cx={x} cy={64} r={i % 2 ? 9 : 12} fill={i % 2 ? acc2 : acc} />
      ))}
      <text x="20" y="124" fill={ink} fontSize="15">
        Свинг: длинная + короткая, «ду-ба ду-ба» (2/3 + 1/3 доли)
      </text>
      {swing.map((x, i) => (
        <circle key={i} cx={x} cy={154} r={i % 2 ? 9 : 12} fill={i % 2 ? acc2 : acc} />
      ))}
      {[0, 1, 2, 3].map((b) => (
        <line key={b} x1={40 + b * 120} y1={176} x2={40 + b * 120} y2={186} stroke={muted} strokeWidth="2" />
      ))}
    </Frame>
  );
}

function StaffIll({ caption }: { caption?: string }) {
  return (
    <figure className="card" style={{ margin: 0, padding: 12 }}>
      <Staff abc={'X:1\nM:none\nL:1/4\nK:C\nE F G A B c d e f |]'} showNames scale={1.5} />
      {caption && <figcaption className="small muted center">{caption}</figcaption>}
    </figure>
  );
}

function Durations({ caption }: { caption?: string }) {
  return (
    <figure className="card" style={{ margin: 0, padding: 12 }}>
      <Staff abc={'X:1\nM:4/4\nL:1/8\nK:C\n"целая"B8 | "половинные"B4 B4 | "четверти"B2 B2 B2 B2 | "восьмые"B B B B B B B B |]'} scale={1.3} />
      {caption && <figcaption className="small muted center">{caption}</figcaption>}
    </figure>
  );
}

function MouthpieceIll({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption} h={180}>
      <path d="M60 80 L420 60 L470 70 L470 110 L420 120 L60 100 Z" fill={acc2} opacity=".2" stroke={acc2} strokeWidth="2" />
      <path d="M60 102 L380 122" stroke={acc3} strokeWidth="7" strokeLinecap="round" />
      <rect x="250" y="52" width="46" height="80" rx="8" fill="none" stroke={muted} strokeWidth="3" />
      <text x="120" y="160" fill={ink} fontSize="15">
        трость
      </text>
      <text x="245" y="40" fill={ink} fontSize="15">
        лигатура
      </text>
      <text x="400" y="40" fill={ink} fontSize="15">
        мундштук
      </text>
    </Frame>
  );
}

export function Illustration({ id, caption }: { id: IllustrationId; caption?: string }) {
  switch (id) {
    case 'breathing':
      return <Breathing caption={caption} />;
    case 'embouchure':
      return <Embouchure caption={caption} />;
    case 'posture':
      return <Posture caption={caption} />;
    case 'tonguing':
      return <Tonguing caption={caption} />;
    case 'octave':
      return <Octave caption={caption} />;
    case 'vibrato':
      return <Vibrato caption={caption} />;
    case 'dynamics':
      return <Dynamics caption={caption} />;
    case 'blues':
      return <Blues caption={caption} />;
    case 'swing':
      return <Swing caption={caption} />;
    case 'staff':
      return <StaffIll caption={caption} />;
    case 'durations':
      return <Durations caption={caption} />;
    case 'mouthpiece':
      return <MouthpieceIll caption={caption} />;
  }
}
