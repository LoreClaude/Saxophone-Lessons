import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Zap, Gauge, Timer, Music2, Hand, FolderOpen, NotebookPen, Shuffle } from 'lucide-react';
import { navigate } from '../../lib/router';
import { db, type PieceRow } from '../../store/db';
import { useProgress } from '../../store/progress';
import { allLessons, lessonStatus, exKey } from '../../content/progression';
import { KIND_NAMES } from '../../practice/types';
import { Stars } from '../components';

export function PracticeHub() {
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const progress = useProgress();
  useEffect(() => {
    db.pieces.orderBy('createdAt').reverse().limit(6).toArray().then(setPieces);
  }, []);
  // exercises to repeat: available lessons, lowest stars first
  const repeat = allLessons()
    .filter((r) => lessonStatus(r, progress) !== 'locked')
    .flatMap((r) => r.lesson.exercises.map((e) => ({ r, e, ep: progress.exercises[exKey(r.lesson.id, e.id)] })))
    .filter((x) => x.ep)
    .sort((a, b) => (a.ep!.stars - b.ep!.stars) || (a.ep!.best - b.ep!.best))
    .slice(0, 6);

  const tiles: [string, string, ReactElement, string][] = [
    ['/warmup', 'Разминка дня', <Zap />, 'Дыхание, долгие ноты и гамма — 5–7 минут'],
    ['/tuner', 'Тюнер', <Gauge />, 'Проверьте строй каждой ноты'],
    ['/metronome', 'Метроном', <Timer />, 'С тренером темпа'],
    ['/drone', 'Бурдон', <Music2 />, 'Слушайте интонацию на фоне опорного тона'],
    ['/fingering', 'Аппликатуры', <Hand />, 'Все ноты альт-саксофона'],
    ['/my', 'Мои ноты', <FolderOpen />, 'Импорт MusicXML/MIDI и свои уроки'],
    ['/diary', 'Дневник', <NotebookPen />, 'Минуты, заметки, таймер занятий'],
  ];
  return (
    <div className="page">
      <h1>Практика</h1>
      <div className="grid grid-4">
        {tiles.map(([path, title, icon, sub]) => (
          <div key={path} className="card hover" onClick={() => navigate(path)}>
            <div className="module-icon" style={{ width: 46, height: 46, fontSize: 22 }}>
              {icon}
            </div>
            <h3 style={{ margin: '12px 0 4px' }}>{title}</h3>
            <div className="small muted">{sub}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-l">
        <Shuffle size={20} /> Повторить
      </h2>
      {repeat.length === 0 ? (
        <div className="muted small">Здесь появятся упражнения, которые стоит подтянуть.</div>
      ) : (
        <div className="grid grid-3">
          {repeat.map(({ r, e, ep }) => (
            <div key={exKey(r.lesson.id, e.id)} className="card hover" onClick={() => navigate(`/exercise/${r.lesson.id}/${e.id}`)}>
              <div className="tiny muted">
                {r.lesson.title} · {KIND_NAMES[e.kind]}
              </div>
              <b>{e.title}</b>
              <div className="row between">
                <Stars n={ep!.stars} size={14} />
                <span className="small muted">{ep!.best}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {pieces.length > 0 && (
        <>
          <h2 className="mt-l">Мои пьесы</h2>
          <div className="grid grid-3">
            {pieces.map((p) => (
              <div key={p.id} className="card hover" onClick={() => navigate(`/my/piece/${p.id}`)}>
                <b>{p.title}</b>
                <div className="tiny muted">{p.bpm} уд/мин</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
