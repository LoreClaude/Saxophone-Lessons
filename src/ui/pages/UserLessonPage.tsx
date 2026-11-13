import { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Save, Plus, Trash2, Play } from 'lucide-react';
import { db, type PieceRow, type UserLessonRow } from '../../store/db';
import { navigate, useRoute } from '../../lib/router';
import type { Exercise, Tier } from '../../practice/types';
import { KIND_NAMES } from '../../practice/types';
import { scaleAbc, longtone, notesDrill, improv, seq } from '../../content/helpers';
import { SCALES, type ScaleType } from '../../music/theory';
import { noteNameRu, SAX_LOW, SAX_HIGH } from '../../music/notes';
import { STYLE_NAMES, type BackingStyle } from '../../audio/backing';
import { Markdown, Modal, Seg } from '../components';
import { ExerciseRunner } from '../practice/Runner';

const ROOTS = [58, 60, 62, 63, 65, 67, 69, 70, 72];

export function UserLessonPage({ id }: { id: string }) {
  const route = useRoute();
  const [lesson, setLesson] = useState<UserLessonRow | null | undefined>(undefined);
  const [edit, setEdit] = useState(route.query.get('edit') === '1');
  const [active, setActive] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);
  const [tier, setTier] = useState<Tier>(2);
  useEffect(() => {
    db.userLessons.get(Number(id)).then((l) => setLesson(l ?? null));
  }, [id]);
  if (lesson === undefined) return null;
  if (lesson === null) return <div className="page">Урок не найден.</div>;
  const exercises = lesson.exercises as Exercise[];
  const save = async (patch: Partial<UserLessonRow>) => {
    const next = { ...lesson, ...patch, updatedAt: Date.now() };
    setLesson(next);
    await db.userLessons.put(next);
  };

  if (active)
    return (
      <div className="page page-wide">
        <button className="btn ghost mb" onClick={() => setActive(null)}>
          <ArrowLeft size={18} /> {lesson.title}
        </button>
        <ExerciseRunner ex={active} ctx={{ exerciseKey: `ulesson/${lesson.id}/${active.id}`, lessonId: `ulesson:${lesson.id}`, lessonTitle: lesson.title, tier }} onNext={() => setActive(null)} nextLabel="К уроку" />
      </div>
    );

  return (
    <div className="page">
      <div className="row between">
        <button className="btn ghost" onClick={() => navigate('/my')}>
          <ArrowLeft size={18} /> Мои уроки
        </button>
        <div className="row">
          {edit ? (
            <button className="btn" onClick={() => setEdit(false)}>
              <Save size={18} /> Готово
            </button>
          ) : (
            <button className="btn ghost" onClick={() => setEdit(true)}>
              <Pencil size={18} /> Редактировать
            </button>
          )}
          <button
            className="btn ghost icon"
            onClick={async () => {
              if (!window.confirm('Удалить урок?')) return;
              await db.userLessons.delete(lesson.id!);
              navigate('/my');
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      {edit ? (
        <div className="col mt" style={{ gap: 12 }}>
          <input type="text" value={lesson.title} onChange={(e) => save({ title: e.target.value })} style={{ fontSize: 22, fontWeight: 700 }} />
          <textarea rows={12} value={lesson.text} onChange={(e) => save({ text: e.target.value })} placeholder="Текст урока (поддерживается Markdown: **жирный**, списки, заголовки ##)" />
          <div className="small muted">Предпросмотр:</div>
          <div className="card">
            <Markdown md={lesson.text} />
          </div>
        </div>
      ) : (
        <div className="mt">
          <h1>{lesson.title}</h1>
          <Markdown md={lesson.text} />
        </div>
      )}
      <div className="row between mt-l">
        <h2 style={{ margin: 0 }}>Упражнения</h2>
        <div className="row">
          <span className="small">Строгость</span>
          <Seg value={String(tier)} onChange={(v) => setTier(Number(v) as Tier)} options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]} />
          {edit && (
            <button className="btn" onClick={() => setAdding(true)}>
              <Plus size={18} /> Добавить
            </button>
          )}
        </div>
      </div>
      <div className="col mt" style={{ gap: 10 }}>
        {exercises.length === 0 && <div className="muted small">Нет упражнений. Нажмите «Редактировать» → «Добавить».</div>}
        {exercises.map((e, i) => (
          <div key={e.id} className="card row between">
            <div>
              <div className="tiny muted">
                {i + 1}. {KIND_NAMES[e.kind]}
              </div>
              <b>{e.title}</b>
            </div>
            <div className="row">
              <button className="btn" onClick={() => setActive(e)}>
                <Play size={16} /> Играть
              </button>
              {edit && (
                <button className="btn ghost icon" onClick={() => save({ exercises: exercises.filter((x) => x.id !== e.id) })}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {adding && (
        <AddExercise
          onClose={() => setAdding(false)}
          onAdd={(e) => {
            save({ exercises: [...exercises, e] });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddExercise({ onClose, onAdd }: { onClose: () => void; onAdd: (e: Exercise) => void }) {
  const [kind, setKind] = useState<'piece' | 'scale' | 'longtone' | 'notes' | 'improv'>('piece');
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [pieceId, setPieceId] = useState<number>(0);
  const [root, setRoot] = useState(60);
  const [stype, setStype] = useState<ScaleType>('major');
  const [bpm, setBpm] = useState(80);
  const [note, setNote] = useState(67);
  const [secs, setSecs] = useState(6);
  const [pool, setPool] = useState<number[]>([67, 69, 71]);
  const [style, setStyle] = useState<BackingStyle>('blues');
  const [chords, setChords] = useState('| G7 | C7 | G7 | G7 | C7 | C7 | G7 | G7 | D7 | C7 | G7 | D7 |');
  useEffect(() => {
    db.pieces.toArray().then((p) => {
      setPieces(p);
      if (p[0]) setPieceId(p[0].id!);
    });
  }, []);
  const uid = () => `u${Date.now().toString(36)}`;
  const make = (): Exercise | null => {
    switch (kind) {
      case 'piece': {
        const p = pieces.find((x) => x.id === pieceId);
        return p ? seq(uid(), p.title, p.abc, { bpm: p.bpm }) : null;
      }
      case 'scale':
        return seq(uid(), `${noteNameRu(root)} ${SCALES[stype].name}`, scaleAbc(root, stype, { bpm }), { bpm, goal: 'Сыграйте гамму вверх и вниз ровными четвертями.' });
      case 'longtone':
        return longtone(uid(), `Долгая ${noteNameRu(note)}`, [note], secs);
      case 'notes':
        return notesDrill(uid(), 'Найди ноту', pool, { count: 10 });
      case 'improv':
        return improv(uid(), `Импровизация: ${STYLE_NAMES[style]}`, { style, chords, bpm, bars: 12, scale: { root: root % 12, type: stype } });
    }
  };
  const all = Array.from({ length: SAX_HIGH - SAX_LOW + 1 }, (_, i) => SAX_LOW + i);
  return (
    <Modal onClose={onClose}>
      <h2>Новое упражнение</h2>
      <Seg value={kind} onChange={setKind} options={[['piece', 'Пьеса'], ['scale', 'Гамма'], ['longtone', 'Долгая нота'], ['notes', 'Найди ноту'], ['improv', 'Импровизация']]} />
      <div className="col mt" style={{ gap: 12 }}>
        {kind === 'piece' &&
          (pieces.length ? (
            <select value={pieceId} onChange={(e) => setPieceId(Number(e.target.value))}>
              {pieces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="muted small">Сначала добавьте пьесу в «Мои ноты».</div>
          ))}
        {(kind === 'scale' || kind === 'improv') && (
          <div className="row wrap">
            <select value={root} onChange={(e) => setRoot(Number(e.target.value))}>
              {ROOTS.map((r) => (
                <option key={r} value={r}>
                  {noteNameRu(r)}
                </option>
              ))}
            </select>
            <select value={stype} onChange={(e) => setStype(e.target.value as ScaleType)}>
              {(Object.keys(SCALES) as ScaleType[]).map((s) => (
                <option key={s} value={s}>
                  {SCALES[s].name}
                </option>
              ))}
            </select>
            <span className="small">Темп</span>
            <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 80)} style={{ width: 80 }} />
          </div>
        )}
        {kind === 'improv' && (
          <>
            <select value={style} onChange={(e) => setStyle(e.target.value as BackingStyle)}>
              {(Object.keys(STYLE_NAMES) as BackingStyle[])
                .filter((s) => s !== 'none')
                .map((s) => (
                  <option key={s} value={s}>
                    {STYLE_NAMES[s]}
                  </option>
                ))}
            </select>
            <input type="text" value={chords} onChange={(e) => setChords(e.target.value)} />
          </>
        )}
        {kind === 'longtone' && (
          <div className="row">
            <select value={note} onChange={(e) => setNote(Number(e.target.value))}>
              {all.map((m) => (
                <option key={m} value={m}>
                  {noteNameRu(m)} ({m})
                </option>
              ))}
            </select>
            <input type="number" value={secs} min={2} max={40} onChange={(e) => setSecs(Number(e.target.value) || 6)} style={{ width: 80 }} />
            <span className="small">секунд</span>
          </div>
        )}
        {kind === 'notes' && (
          <div className="row wrap" style={{ gap: 4 }}>
            {all.map((m) => (
              <button key={m} className={`btn ${pool.includes(m) ? '' : 'ghost'}`} style={{ padding: '4px 8px' }} onClick={() => setPool((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}>
                {noteNameRu(m)}
              </button>
            ))}
          </div>
        )}
        <div className="row between">
          <button className="btn ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            className="btn"
            onClick={() => {
              const e = make();
              if (e) onAdd(e);
            }}
          >
            Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}
