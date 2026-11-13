import { useEffect, useState } from 'react';
import { Volume2, Ear } from 'lucide-react';
import { SAX_HIGH, SAX_LOW, concertToWritten, fullNoteNameRu, noteNameRu, octaveOf } from '../../music/notes';
import { describeFingering, fingeringsFor } from '../../music/fingering';
import { audio } from '../../audio/engine';
import { playDemo } from '../../lib/demo';
import { buildAbc } from '../../music/abc';
import { FingeringDiagram } from '../notation/Fingering';
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
          <FingeringDiagram fingering={f} />
          <div className="small">{f ? describeFingering(f) : ''}</div>
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
            <b>Обозначения:</b> 1–2–3 — указательный, средний и безымянный пальцы левой руки; 4–5–6 — правой. «8» — октавный клапан (большой палец левой руки).
            Ладонные клапаны нажимаются ладонью левой руки, боковые — ребром указательного пальца правой.
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
