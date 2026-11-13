import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Save } from 'lucide-react';
import { db, todayKey, type DiaryRow } from '../../store/db';
import { useProgress } from '../../store/progress';
import { toast } from '../../lib/toast';

export function DiaryPage() {
  const days = useProgress((s) => s.days);
  const addSeconds = useProgress((s) => s.addPracticeSeconds);
  const [rows, setRows] = useState<Record<string, DiaryRow>>({});
  const [note, setNote] = useState('');
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const iv = useRef(0);
  const today = todayKey();

  useEffect(() => {
    db.diary.toArray().then((all) => {
      const map = Object.fromEntries(all.map((r) => [r.day, r]));
      setRows(map);
      setNote(map[today]?.note ?? '');
    });
  }, [today]);
  useEffect(() => () => window.clearInterval(iv.current), []);

  const saveNote = async () => {
    const row: DiaryRow = { day: today, note, manualMinutes: rows[today]?.manualMinutes ?? 0 };
    await db.diary.put(row);
    setRows((r) => ({ ...r, [today]: row }));
    toast('📝', 'Заметка сохранена');
  };

  const toggle = () => {
    if (running) {
      window.clearInterval(iv.current);
      setRunning(false);
      const mins = Math.floor(timer / 60);
      if (timer >= 30) {
        addSeconds(timer);
        const row: DiaryRow = { day: today, note, manualMinutes: (rows[today]?.manualMinutes ?? 0) + mins };
        db.diary.put(row);
        setRows((r) => ({ ...r, [today]: row }));
        toast('⏱️', 'Занятие записано', `${mins} мин добавлено в статистику`);
      }
      setTimer(0);
      return;
    }
    setRunning(true);
    iv.current = window.setInterval(() => setTimer((t) => t + 1), 1000);
  };

  const list = Array.from(new Set([...Object.keys(days), ...Object.keys(rows)]))
    .sort()
    .reverse()
    .slice(0, 60);

  return (
    <div className="page">
      <h1>Дневник занятий</h1>
      <div className="grid grid-2">
        <div className="card col center" style={{ alignItems: 'center' }}>
          <h3>Таймер занятия без приложения</h3>
          <div className="small muted">Играете по бумажным нотам или с учителем? Включите таймер — время попадёт в статистику.</div>
          <div className="display" style={{ fontSize: 64, fontWeight: 800 }}>
            {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
          </div>
          <button className={`btn big ${running ? 'danger' : ''}`} onClick={toggle}>
            {running ? <Pause size={18} /> : <Play size={18} />} {running ? 'Закончить' : 'Старт'}
          </button>
        </div>
        <div className="card col">
          <h3>Заметка на сегодня</h3>
          <textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что получилось, что не получилось, какие ощущения в губах и дыхании…" />
          <button className="btn" onClick={saveNote}>
            <Save size={18} /> Сохранить
          </button>
        </div>
      </div>
      <div className="card mt">
        <h3>История</h3>
        <div className="col" style={{ gap: 8 }}>
          {list.length === 0 && <div className="muted small">Пока пусто.</div>}
          {list.map((d) => (
            <div key={d} className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
              <b style={{ width: 110 }}>{new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' })}</b>
              <span className="small" style={{ width: 120 }}>
                {Math.round((days[d]?.seconds ?? 0) / 60)} мин · {days[d]?.attempts ?? 0} попыток
              </span>
              <span className="small muted grow">{rows[d]?.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
