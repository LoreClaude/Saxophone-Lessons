import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { db, type PieceRow } from '../../store/db';
import { navigate } from '../../lib/router';
import { ExerciseRunner } from '../practice/Runner';
import type { SequenceExercise, Tier } from '../../practice/types';
import { STYLE_NAMES, type BackingStyle } from '../../audio/backing';
import { parseChordChart } from '../../music/theory';
import { Seg } from '../components';

export function PiecePage({ id }: { id: number }) {
  const [piece, setPiece] = useState<PieceRow | null | undefined>(undefined);
  const [tier, setTier] = useState<Tier>(2);
  const [style, setStyle] = useState<BackingStyle>('none');
  const [chords, setChords] = useState('');
  useEffect(() => {
    db.pieces.get(id).then((p) => {
      setPiece(p ?? null);
      if (p?.style) setStyle(p.style as BackingStyle);
      if (p?.chords) setChords(p.chords);
    });
  }, [id]);
  if (piece === undefined) return null;
  if (piece === null) return <div className="page">Пьеса не найдена.</div>;
  let chordsOk = true;
  try {
    if (chords.trim()) parseChordChart(chords).forEach((b) => b.forEach(() => 0));
  } catch {
    chordsOk = false;
  }
  const ex: SequenceExercise = {
    id: `piece-${piece.id}`,
    kind: 'sequence',
    title: piece.title,
    abc: piece.abc,
    bpm: piece.bpm,
    goal: 'Сыграйте пьесу. Начните в режиме «ожидание», затем — в темпе (можно замедлить).',
    modes: ['tempo', 'wait'],
    metronome: true,
    showNames: true,
    style: style !== 'none' && chords.trim() && chordsOk ? style : undefined,
    chords: chords.trim() || undefined,
  };
  return (
    <div className="page page-wide">
      <button className="btn ghost mb" onClick={() => navigate('/my')}>
        <ArrowLeft size={18} /> Мои ноты
      </button>
      <div className="card mb row wrap" style={{ gap: 18 }}>
        <div className="row">
          <span className="small">Строгость</span>
          <Seg value={String(tier)} onChange={(v) => setTier(Number(v) as Tier)} options={[['1', 'Новичок'], ['2', 'Ученик'], ['3', 'Музыкант'], ['4', 'Мастер']]} />
        </div>
        <div className="row">
          <span className="small">Аккомпанемент</span>
          <select
            value={style}
            onChange={(e) => {
              setStyle(e.target.value as BackingStyle);
              db.pieces.update(piece.id!, { style: e.target.value });
            }}
          >
            {(Object.keys(STYLE_NAMES) as BackingStyle[]).map((s) => (
              <option key={s} value={s}>
                {STYLE_NAMES[s]}
              </option>
            ))}
          </select>
        </div>
        {style !== 'none' && (
          <div className="row grow">
            <span className="small">Аккорды по тактам</span>
            <input
              type="text"
              className="grow"
              placeholder="| C | Am | F | G7 |  (в строе саксофона)"
              value={chords}
              onChange={(e) => {
                setChords(e.target.value);
                db.pieces.update(piece.id!, { chords: e.target.value });
              }}
            />
            {!chordsOk && <span className="small" style={{ color: 'var(--bad)' }}>ошибка в аккордах</span>}
          </div>
        )}
      </div>
      <ExerciseRunner key={`${tier}-${style}-${chords}`} ex={ex} ctx={{ exerciseKey: `piece/${piece.id}`, lessonId: 'my', lessonTitle: piece.title, tier }} />
    </div>
  );
}
