import { useEffect, useState } from 'react';
import { Volume2, Ear } from 'lucide-react';
import { SAX_HIGH, SAX_LOW, concertToWritten, fullNoteNameRu, noteNameRu, octaveOf } from '../../music/notes';
import { fingeringsFor } from '../../music/fingering';
import { audio } from '../../audio/engine';
import { playDemo } from '../../lib/demo';
import { buildAbc } from '../../music/abc';
import { FingeringDiagram, FingeringLegend } from '../notation/Fingering';
import { Staff } from '../notation/Staff';
import { Toggle } from '../components';
import { useMic } from '../practice/common';

export function FingeringPage() {
  const [note, setNote] = useState(67);
  const [variant, setVariant] = useState(0);
  const [listen, setListen] = useState(false);
  const notes = Array.from({ length: SAX_HIGH - SAX_LOW + 1 }, (_, i) => SAX_LOW + i);
  const fs = fingeringsFor(note);
  const f = fs[Math.min(variant, fs.length - 1)];

  return (
    <div className="page">
      <h1>Аппликатуры альт-саксофона</h1>
      <p className="muted">Выберите ноту — увидите, какие клавиши нажимать. Аппликатуры одинаковы для всех саксофонов (сопрано, альт, тенор, баритон).</p>
      {listen && <ListenMode onNote={(m) => { setNote(m); setVariant(0); }} />}
      <div className="grid" style={{ gridTemplateColumns: '340px 1fr', alignItems: 'start' }}>
        <div className="card center">
          <div className="display" style={{ fontSize: 26, fontWeight: 800 }}>
            {fullNoteNameRu(note)}
          </div>
          <FingeringDiagram fingering={f} size={1.25} />
          <FingeringLegend fingering={f} />
          {f?.note && <div className="small muted mt">{f.note}</div>}
          {fs.length > 1 && (
            <div className="row wrap mt" style={{ justifyContent: 'center' }}>
              {fs.map((x, i) => (
                <button key={i} className={`btn ${i === variant ? '' : 'ghost'}`} onClick={() => setVariant(i)}>
                  {x.variant}
                </button>
              ))}
            </div>
          )}
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn ghost" onClick={() => playDemo({ kind: 'note', note })}>
              <Volume2 size={18} /> Послушать
            </button>
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card">
            <Staff abc={buildAbc([{ midi: note, beats: 4 }], { key: 'C' }).replace('M:4/4', 'M:none')} scale={1.6} />
          </div>
          <div className="card">
            <div className="row between mb">
              <b>Все ноты</b>
              <Toggle on={listen} onChange={setListen} label={<span className="row" style={{ gap: 6 }}><Ear size={16} /> Режим «слушаю»</span>} />
            </div>
            {[3, 4, 5, 6].map((oct) => (
              <div key={oct} className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                <span className="tiny muted" style={{ width: 80 }}>
                  {oct === 3 ? 'малая' : oct === 4 ? 'первая' : oct === 5 ? 'вторая' : 'третья'}
                </span>
                {notes
                  .filter((m) => octaveOf(m) === oct)
                  .map((m) => (
                    <button key={m} className={`btn ${m === note ? '' : 'ghost'}`} style={{ padding: '6px 10px', minWidth: 54 }} onClick={() => { setNote(m); setVariant(0); }}>
                      {noteNameRu(m)}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="card small">
            <b>Как читать схему.</b> Закрашенные клапаны нужно нажать, остальные оставить открытыми.
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>Три больших клапана сверху закрывают указательный, средний и безымянный пальцы левой руки (в уроках они — 1, 2, 3), три снизу — те же пальцы правой руки (4, 5, 6).</li>
              <li>Маленький кружок между первым и вторым клапаном — клапан бис, а маленький овал над первым — передний клапан фа. Оба нажимает указательный палец левой руки.</li>
              <li>Саксофон нарисован так, как вы видите его во время игры: левая сторона рисунка — под левой рукой.</li>
              <li>Овал слева между первым и вторым клапаном — октавный клапан. Он сзади инструмента, его нажимает большой палец левой руки.</li>
              <li>Три клапана слева вверху — ладонные, их нажимает ладонь левой руки.</li>
              <li>Группа клапанов слева посередине — для мизинца левой руки.</li>
              <li>Клапаны справа от нижних, между корпусом и раструбом, — боковые, их нажимает ребро ладони правой руки. Отдельный клапан под ними — высокий фа-диез.</li>
              <li>Два клапана внизу справа — для мизинца правой руки.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListenMode({ onNote }: { onNote: (m: number) => void }) {
  useMic();
  useEffect(() => {
    let stable = 0;
    let last = -1;
    const off = audio.onFrame((f) => {
      if (!f.voiced) {
        stable = 0;
        return;
      }
      const w = Math.round(concertToWritten(f.midi));
      if (w === last) stable++;
      else {
        last = w;
        stable = 0;
      }
      if (stable === 8 && w >= SAX_LOW && w <= SAX_HIGH) onNote(w);
    });
    return off;
  }, [onNote]);
  return <div className="card mb small">🎧 Сыграйте ноту — я покажу её аппликатуру.</div>;
}
