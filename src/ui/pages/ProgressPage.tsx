import { useEffect, useMemo, useState } from 'react';
import { Flame, Clock, Trophy, Target, Sparkles, BookOpen } from 'lucide-react';
import { useProgress, SKILL_NAMES, type SkillId } from '../../store/progress';
import { db, todayKey, type AttemptRow } from '../../store/db';
import { levelFromXp, rankFor } from '../../game/levels';
import { ACHIEVEMENTS } from '../../game/achievements';
import { courseProgress } from '../../content/progression';
import { SAX_HIGH, SAX_LOW, noteNameRu } from '../../music/notes';
import { aiAvailable, weeklyReport } from '../../ai/tutor';
import { navigate } from '../../lib/router';
import { Bar, Markdown, Mascot } from '../components';
import { CalendarHeatmap, ColumnChart, DivergingStrip, LineChart, MeterList, StatTile, TableToggle } from '../charts';

export function ProgressPage() {
  const p = useProgress();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [report, setReport] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    db.attempts.orderBy('date').reverse().limit(500).toArray().then(setAttempts);
  }, []);
  const lv = levelFromXp(p.xp);
  const cp = courseProgress(p);
  const minutesByDay = useMemo(() => Object.fromEntries(Object.entries(p.days).map(([d, v]) => [d, v.seconds / 60])), [p.days]);

  const last30 = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = todayKey(d);
      out.push({ label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`, value: Math.round((p.days[k]?.seconds ?? 0) / 60) });
    }
    return out;
  }, [p.days]);

  const weekly = useMemo(() => {
    const byWeek = new Map<string, number[]>();
    for (const a of attempts) {
      const d = new Date(a.date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = todayKey(monday);
      byWeek.set(k, [...(byWeek.get(k) ?? []), a.score]);
    }
    return [...byWeek.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-16)
      .map(([k, v]) => ({ label: k.slice(5).split('-').reverse().join('.'), value: v.reduce((x, y) => x + y, 0) / v.length }));
  }, [attempts]);

  const notes = useMemo(() => {
    const out: { label: string; value: number | null; n: number }[] = [];
    for (let m = SAX_LOW; m <= SAX_HIGH; m++) {
      const st = p.noteStats[m];
      out.push({ label: noteNameRu(m), value: st && st.n >= 2 ? st.cents : null, n: st?.n ?? 0 });
    }
    return out;
  }, [p.noteStats]);

  const skills = (Object.keys(SKILL_NAMES) as SkillId[]).map((k) => ({ name: SKILL_NAMES[k], value: p.skills[k] ?? null }));
  const totalMin = Math.round(p.totals.seconds / 60);

  const askReport = async () => {
    if (!(await aiAvailable())) {
      navigate('/settings');
      return;
    }
    setBusy(true);
    setErr('');
    setReport('');
    try {
      let acc = '';
      await weeklyReport((d) => {
        acc += d;
        setReport(acc);
      });
    } catch (e: any) {
      setErr(e?.message || 'Ошибка');
    }
    setBusy(false);
  };

  return (
    <div className="page">
      <h1>Прогресс</h1>
      <div className="grid grid-4">
        <StatTile label="Уровень" value={lv.level} sub={`${rankFor(lv.level)} · ${p.xp} XP`} icon={<Trophy size={18} color="var(--accent-3)" />} />
        <StatTile label="Серия дней" value={p.streak.current} sub={`рекорд: ${p.streak.best}`} icon={<Flame size={18} color="var(--accent-3)" />} />
        <StatTile label="Время практики" value={totalMin >= 120 ? `${(totalMin / 60).toFixed(1)} ч` : `${totalMin} мин`} sub={`попыток: ${p.totals.attempts}`} icon={<Clock size={18} color="var(--accent-2)" />} />
        <StatTile label="Курс" value={`${cp.percent}%`} sub={`${cp.done} из ${cp.total} уроков`} icon={<BookOpen size={18} color="var(--accent-2)" />} />
      </div>

      <div className="card mt">
        <h3>Календарь занятий</h3>
        <CalendarHeatmap values={minutesByDay} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <h3>Минуты практики за 30 дней</h3>
          <ColumnChart data={last30} unit="мин" />
          <TableToggle head={['День', 'Минут']} rows={last30.filter((d) => d.value > 0).map((d) => [d.label, d.value])} />
        </div>
        <div className="card">
          <h3>Средний балл по неделям</h3>
          {weekly.length ? <LineChart data={weekly} /> : <div className="muted small">Пока нет попыток — сыграйте первое упражнение.</div>}
          <TableToggle head={['Неделя с', 'Средний балл']} rows={weekly.map((w) => [w.label, Math.round(w.value)])} />
        </div>
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <h3>Навыки</h3>
          <div className="small muted mb">0–100, по последним попыткам. «—» — ещё не измерено.</div>
          <MeterList rows={skills} />
        </div>
        <div className="card">
          <h3>Рекорды</h3>
          <div className="col" style={{ gap: 8 }}>
            <Rec label="Самая долгая нота" value={`${p.records.longestToneSec.toFixed(1)} с`} />
            <Rec label="Самый долгий выдох" value={`${p.records.longestBreathSec.toFixed(1)} с`} />
            <Rec label="Лучшее комбо" value={`×${p.records.maxCombo}`} />
            <Rec label="Лучшая импровизация" value={`${p.records.bestImprov}%`} />
            <Rec label="Максимальный темп (зачёт)" value={p.records.fastestBpm ? `${p.records.fastestBpm} уд/мин` : '—'} />
            <Rec label="Верно сыграно нот" value={String(p.records.totalNotes)} />
            <Rec label="Разминок" value={String(p.totals.warmups)} />
          </div>
        </div>
      </div>

      <div className="card mt">
        <h3>Интонация по нотам</h3>
        <div className="small muted mb">
          Какие ноты вы обычно завышаете (красные) или занижаете (синие). Для альт-саксофона типично завышать верхние ноты и занижать нижние.
        </div>
        <DivergingStrip items={notes} />
        <TableToggle head={['Нота', 'Отклонение, центов', 'Измерений']} rows={notes.filter((x) => x.value !== null).map((x) => [x.label, Math.round(x.value!), x.n])} />
      </div>

      <div className="card mt">
        <div className="row between">
          <h3 style={{ margin: 0 }}>
            <Sparkles size={18} color="var(--accent-3)" /> Недельный отчёт от Бибопа
          </h3>
          <button className="btn" onClick={askReport} disabled={busy}>
            {busy ? 'Пишу отчёт…' : 'Составить отчёт'}
          </button>
        </div>
        {(report || err) && (
          <div className="tutor-bubble mt">
            <Mascot size={54} mood="happy" />
            <div className="bubble">{err ? <span style={{ color: 'var(--bad)' }}>{err}</span> : <Markdown md={report} />}</div>
          </div>
        )}
      </div>

      <div className="card mt">
        <h3>
          <Target size={18} /> Достижения: {Object.keys(p.achievements).length} из {ACHIEVEMENTS.length}
        </h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
          {ACHIEVEMENTS.map((a) => {
            const got = p.achievements[a.id];
            return (
              <div key={a.id} className="card" style={{ padding: 12, opacity: got ? 1 : 0.45, filter: got ? 'none' : 'grayscale(1)' }} title={a.description}>
                <div style={{ fontSize: 28 }}>{a.icon}</div>
                <b className="small">{a.title}</b>
                <div className="tiny muted">{a.description}</div>
                {got && <div className="tiny" style={{ color: 'var(--good)' }}>{new Date(got).toLocaleDateString('ru-RU')}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mt">
        <h3>Последние попытки</h3>
        {attempts.length === 0 && <div className="muted small">Пока пусто.</div>}
        <div className="col" style={{ gap: 6 }}>
          {attempts.slice(0, 15).map((a) => (
            <div key={a.id} className="row" style={{ gap: 12 }}>
              <span className="tiny muted" style={{ width: 120 }}>
                {new Date(a.date).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="grow small">{a.title}</span>
              <div style={{ width: 140 }}>
                <Bar value={a.score} thin />
              </div>
              <b className="small" style={{ width: 44, textAlign: 'right' }}>
                {a.score}%
              </b>
              <span className="tiny" style={{ width: 20 }}>
                {a.passed ? '✅' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Rec({ label, value }: { label: string; value: string }) {
  return (
    <div className="row between">
      <span className="small">{label}</span>
      <b>{value}</b>
    </div>
  );
}
