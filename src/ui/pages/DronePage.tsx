import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { audio } from '../../audio/engine';
import { startDrone } from '../../audio/synth';
import { noteNameRu, writtenToConcert } from '../../music/notes';
import { useSettings } from '../../store/settings';
import { Seg } from '../components';
import { LivePitch, useMic } from '../practice/common';

const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function DronePage() {
  useMic();
  const a4 = useSettings((s) => s.a4);
  const [pc, setPc] = useState(0);
  const [type, setType] = useState<'organ' | 'soft' | 'fifth'>('organ');
  const [vol, setVol] = useState(0.35);
  const [on, setOn] = useState(false);
  const drone = useRef<ReturnType<typeof startDrone> | null>(null);
  const written = 60 + pc; // middle register for reference
  const concert = writtenToConcert(written);

  useEffect(() => () => drone.current?.stop(), []);
  useEffect(() => {
    drone.current?.setNote(concert);
  }, [concert]);
  useEffect(() => {
    drone.current?.setVolume(vol);
  }, [vol]);

  const toggle = async () => {
    if (on) {
      drone.current?.stop();
      drone.current = null;
      setOn(false);
      return;
    }
    await audio.ensureContext();
    drone.current = startDrone(concert, vol, type, a4);
    setOn(true);
  };
  useEffect(() => {
    if (on) {
      drone.current?.stop();
      drone.current = startDrone(concert, vol, type, a4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, a4]);

  return (
    <div className="page">
      <h1>Бурдон</h1>
      <p className="muted">
        Бурдон — непрерывный опорный звук. Играйте долгие ноты и гаммы на его фоне и слушайте «биения»: когда звук чистый, биения исчезают. Это лучший способ
        натренировать слух на интонацию.
      </p>
      <div className="grid" style={{ gridTemplateColumns: '1fr 300px' }}>
        <div className="card col" style={{ gap: 18 }}>
          <div>
            <div className="small muted mb">Тоника (в строе саксофона)</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
              {PCS.map((p) => (
                <button key={p} className={`btn ${p === pc ? '' : 'ghost'}`} onClick={() => setPc(p)}>
                  {noteNameRu(60 + p)}
                </button>
              ))}
            </div>
            <div className="small muted mt">
              Звучит: {noteNameRu(concert)} фортепиано. Для гаммы {noteNameRu(written)} мажор выбирайте тонику {noteNameRu(written)}.
            </div>
          </div>
          <div className="row wrap" style={{ gap: 18 }}>
            <Seg value={type} onChange={setType} options={[['organ', 'Орган'], ['soft', 'Мягкий'], ['fifth', 'С квинтой']]} />
            <div className="row" style={{ minWidth: 240 }}>
              <span className="small">Громкость</span>
              <input type="range" min={0.05} max={0.8} step={0.01} value={vol} onChange={(e) => setVol(Number(e.target.value))} />
            </div>
          </div>
          <button className={`btn big ${on ? 'danger' : ''}`} onClick={toggle}>
            {on ? <Square size={18} /> : <Play size={20} />} {on ? 'Остановить' : 'Включить бурдон'}
          </button>
        </div>
        <LivePitch />
      </div>
    </div>
  );
}
