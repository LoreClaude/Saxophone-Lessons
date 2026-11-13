import { useEffect, useMemo, useState } from 'react';
import { Upload, Music, Plus, Trash2, Play, PenLine, BookPlus, Undo2 } from 'lucide-react';
import { db, type PieceRow, type UserLessonRow } from '../../store/db';
import { parseMidi, parseMusicXml, readMxl, partToAbc, type ImportResult } from '../../music/importers';
import { parseScore, buildAbc, type BuildNote } from '../../music/abc';
import { SAX_HIGH, SAX_LOW, noteNameRu, octaveOf } from '../../music/notes';
import { navigate } from '../../lib/router';
import { playDemo } from '../../lib/demo';
import { toast } from '../../lib/toast';
import { useProgress } from '../../store/progress';
import { celebrate } from '../../lib/toast';
import { Modal, Seg, Toggle, Empty } from '../components';
import { Staff } from '../notation/Staff';
import { guessKey } from '../../music/importers';

export function MyMusicPage() {
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [lessons, setLessons] = useState<UserLessonRow[]>([]);
  const [importing, setImporting] = useState<{ result: ImportResult; fileName: string } | null>(null);
  const [composer, setComposer] = useState(false);
  const reload = () => {
    db.pieces.orderBy('createdAt').reverse().toArray().then(setPieces);
    db.userLessons.orderBy('updatedAt').reverse().toArray().then(setLessons);
  };
  useEffect(reload, []);

  const onFile = async (f: File) => {
    try {
      const name = f.name.toLowerCase();
      let result: ImportResult;
      if (name.endsWith('.mid') || name.endsWith('.midi')) result = parseMidi(await f.arrayBuffer());
      else if (name.endsWith('.mxl')) result = parseMusicXml(readMxl(new Uint8Array(await f.arrayBuffer())));
      else if (name.endsWith('.xml') || name.endsWith('.musicxml')) result = parseMusicXml(await f.text());
      else if (name.endsWith('.abc') || name.endsWith('.txt')) {
        const abc = await f.text();
        const sc = parseScore(abc);
        await savePiece({ title: sc.title || f.name.replace(/\.\w+$/, ''), abc, bpm: sc.bpm, source: 'abc' });
        reload();
        return;
      } else throw new Error('Поддерживаются MusicXML (.musicxml, .xml, .mxl), MIDI (.mid) и ABC (.abc)');
      setImporting({ result, fileName: f.name });
    } catch (e: any) {
      toast('⚠️', 'Не удалось открыть файл', e?.message);
    }
  };

  return (
    <div className="page">
      <h1>Мои ноты и уроки</h1>
      <p className="muted">
        Добавьте любимые мелодии — из MuseScore (MusicXML), MIDI-файла или наберите сами — и тренируйте их с той же оценкой, что и уроки курса.
      </p>
      <div className="row wrap">
        <label className="btn">
          <Upload size={18} /> Импорт файла
          <input type="file" hidden accept=".musicxml,.xml,.mxl,.mid,.midi,.abc,.txt" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <button className="btn ghost" onClick={() => setComposer(true)}>
          <PenLine size={18} /> Набрать мелодию
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            const id = await db.userLessons.add({ title: 'Мой урок', text: '## Мой урок\n\nОпишите, что тренируем.', exercises: [], createdAt: Date.now(), updatedAt: Date.now() });
            navigate(`/my/lesson/${id}?edit=1`);
          }}
        >
          <BookPlus size={18} /> Создать урок
        </button>
      </div>

      <h2 className="mt-l">Пьесы</h2>
      {pieces.length === 0 ? (
        <Empty icon={<Music size={40} />} title="Пока нет своих нот" text="Импортируйте файл или наберите мелодию." />
      ) : (
        <div className="grid grid-3">
          {pieces.map((p) => (
            <div key={p.id} className="card hover" onClick={() => navigate(`/my/piece/${p.id}`)}>
              <div className="row between">
                <b>{p.title}</b>
                <button
                  className="btn ghost icon"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Удалить «${p.title}»?`)) return;
                    await db.pieces.delete(p.id!);
                    reload();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="tiny muted">
                {p.source} · {p.bpm} уд/мин · {new Date(p.createdAt).toLocaleDateString('ru-RU')}
              </div>
              <div style={{ maxHeight: 110, overflow: 'hidden', pointerEvents: 'none' }}>
                <Staff abc={p.abc} scale={0.7} compact />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-l">Мои уроки</h2>
      {lessons.length === 0 ? (
        <div className="muted small">Создайте урок: текст + упражнения из ваших пьес, гамм и долгих нот.</div>
      ) : (
        <div className="grid grid-3">
          {lessons.map((l) => (
            <div key={l.id} className="card hover" onClick={() => navigate(`/my/lesson/${l.id}`)}>
              <b>{l.title}</b>
              <div className="tiny muted">{l.exercises.length} упражнений</div>
            </div>
          ))}
        </div>
      )}

      {importing && (
        <ImportDialog
          data={importing}
          onClose={() => setImporting(null)}
          onSaved={(id) => {
            setImporting(null);
            reload();
            navigate(`/my/piece/${id}`);
          }}
        />
      )}
      {composer && (
        <Composer
          onClose={() => setComposer(false)}
          onSaved={(id) => {
            setComposer(false);
            navigate(`/my/piece/${id}`);
          }}
        />
      )}
    </div>
  );
}

async function savePiece(p: Omit<PieceRow, 'id' | 'createdAt'>) {
  const id = await db.pieces.add({ ...p, createdAt: Date.now() });
  const ok = useProgress.getState().unlock('my_piece');
  if (ok) celebrate({ xpGained: 0, levelBefore: 0, levelAfter: 0, newAchievements: ['my_piece'], questsDone: [], firstPass: false, newBest: false });
  return id as number;
}

function ImportDialog({ data, onClose, onSaved }: { data: { result: ImportResult; fileName: string }; onClose: () => void; onSaved: (id: number) => void }) {
  const parts = data.result.parts;
  const [pi, setPi] = useState(0);
  const part = parts[pi];
  const [concert, setConcert] = useState(!part.isWritten);
  const [octave, setOctave] = useState(0);
  const [title, setTitle] = useState(data.result.title || data.fileName);
  const [bpm, setBpm] = useState(part.bpm);
  useEffect(() => {
    setConcert(!parts[pi].isWritten);
    setBpm(parts[pi].bpm);
  }, [pi, parts]);
  const conv = useMemo(() => {
    try {
      return partToAbc(part, { concert, title, bpm, meter: part.meter, octave });
    } catch (e: any) {
      return { abc: '', outOfRange: 0, error: e?.message } as any;
    }
  }, [part, concert, title, bpm, octave]);
  return (
    <Modal onClose={onClose} wide>
      <h2>Импорт: {data.fileName}</h2>
      <div className="col" style={{ gap: 12 }}>
        {parts.length > 1 && (
          <div className="row">
            <span className="small" style={{ width: 160 }}>
              Партия / дорожка
            </span>
            <select value={pi} onChange={(e) => setPi(Number(e.target.value))} className="grow">
              {parts.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.name} ({p.notes.filter((n) => n.midi !== null).length} нот)
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="row">
          <span className="small" style={{ width: 160 }}>
            Название
          </span>
          <input type="text" className="grow" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="row wrap" style={{ gap: 18 }}>
          <Toggle on={concert} onChange={setConcert} label="Ноты в концертном строе (фортепиано, гитара, голос) — переложить для альт-саксофона" />
        </div>
        <div className="row wrap" style={{ gap: 18 }}>
          <div className="row">
            <span className="small">Октава</span>
            <Seg value={String(octave)} onChange={(v) => setOctave(Number(v))} options={[['-1', 'ниже'], ['0', 'авто'], ['1', 'выше']]} />
          </div>
          <div className="row">
            <span className="small">Темп</span>
            <input type="number" min={30} max={260} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 90)} style={{ width: 90 }} />
          </div>
        </div>
        {part.polyphonic && <div className="small" style={{ color: 'var(--ok)' }}>В партии были аккорды или несколько голосов — оставлен верхний голос.</div>}
        {conv.outOfRange > 0 && <div className="small" style={{ color: 'var(--bad)' }}>{conv.outOfRange} нот вне диапазона альт-саксофона. Попробуйте сдвинуть октаву.</div>}
        {conv.abc ? (
          <div className="card" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <Staff abc={conv.abc} scale={0.9} />
          </div>
        ) : (
          <div style={{ color: 'var(--bad)' }}>{conv.error}</div>
        )}
        <div className="row between">
          <button className="btn ghost" onClick={() => conv.abc && playDemo({ kind: 'abc', abc: conv.abc, bpm })}>
            <Play size={16} /> Послушать
          </button>
          <div className="row">
            <button className="btn ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn"
              disabled={!conv.abc}
              onClick={async () => onSaved(await savePiece({ title: title || 'Без названия', abc: conv.abc, bpm, source: data.fileName.split('.').pop()?.toUpperCase() || 'файл' }))}
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const DURS: [string, number][] = [
  ['𝅝 целая', 4],
  ['𝅗𝅥 половинная', 2],
  ['♩ четверть', 1],
  ['♪ восьмая', 0.5],
  ['𝅘𝅥𝅯 шестнадцатая', 0.25],
];

function Composer({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [notes, setNotes] = useState<BuildNote[]>([]);
  const [dur, setDur] = useState(1);
  const [dot, setDot] = useState(false);
  const [title, setTitle] = useState('Моя мелодия');
  const [bpm, setBpm] = useState(90);
  const [meter, setMeter] = useState('4/4');
  const len = dot ? dur * 1.5 : dur;
  const all = Array.from({ length: SAX_HIGH - SAX_LOW + 1 }, (_, i) => SAX_LOW + i);
  const abc = useMemo(() => {
    if (!notes.length) return '';
    const m = meter.split('/').map(Number) as [number, number];
    return buildAbc(notes, { key: guessKey(notes.filter((x) => x.midi !== null).map((x) => x.midi!)), meter: m, bpm, title });
  }, [notes, bpm, meter, title]);
  return (
    <Modal onClose={onClose} wide>
      <h2>Набрать мелодию</h2>
      <div className="col" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 14 }}>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Seg value={meter} onChange={setMeter} options={[['4/4', '4/4'], ['3/4', '3/4'], ['2/4', '2/4']]} />
          <span className="small">Темп</span>
          <input type="number" value={bpm} min={30} max={240} onChange={(e) => setBpm(Number(e.target.value) || 90)} style={{ width: 80 }} />
        </div>
        <div className="row wrap">
          {DURS.map(([l, v]) => (
            <button key={v} className={`btn ${dur === v ? '' : 'ghost'}`} onClick={() => setDur(v)}>
              {l}
            </button>
          ))}
          <Toggle on={dot} onChange={setDot} label="с точкой" />
        </div>
        <div>
          {[3, 4, 5, 6].map((o) => (
            <div key={o} className="row wrap" style={{ gap: 4, marginBottom: 4 }}>
              {all
                .filter((m) => octaveOf(m) === o)
                .map((m) => (
                  <button key={m} className="btn ghost" style={{ padding: '6px 9px', minWidth: 48 }} onClick={() => setNotes((n) => [...n, { midi: m, beats: len }])}>
                    {noteNameRu(m)}
                    <sup>{o - 3}</sup>
                  </button>
                ))}
            </div>
          ))}
          <div className="row">
            <button className="btn ghost" onClick={() => setNotes((n) => [...n, { midi: null, beats: len }])}>
              Пауза
            </button>
            <button className="btn ghost" onClick={() => setNotes((n) => n.slice(0, -1))} disabled={!notes.length}>
              <Undo2 size={16} /> Убрать последнюю
            </button>
            <button className="btn ghost" onClick={() => setNotes([])} disabled={!notes.length}>
              Очистить
            </button>
          </div>
        </div>
        <div className="card" style={{ minHeight: 120 }}>
          {abc ? <Staff abc={abc} scale={0.9} showNames /> : <div className="muted small">Нажимайте на ноты — они появятся здесь.</div>}
        </div>
        <div className="row between">
          <button className="btn ghost" onClick={() => abc && playDemo({ kind: 'abc', abc, bpm })} disabled={!abc}>
            <Play size={16} /> Послушать
          </button>
          <button className="btn" disabled={!abc} onClick={async () => onSaved(await savePiece({ title, abc, bpm, source: 'редактор' }))}>
            <Plus size={16} /> Сохранить пьесу
          </button>
        </div>
      </div>
    </Modal>
  );
}
