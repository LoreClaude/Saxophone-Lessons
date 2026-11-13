import { Lock, Play, Trophy, Zap, CheckCircle2 } from 'lucide-react';
import { COURSE } from '../../content/course';
import { allLessons, courseProgress, examStatus, lessonStatus, nextLesson, pendingExam, exKey } from '../../content/progression';
import { useProgress } from '../../store/progress';
import { useSettings } from '../../store/settings';
import { navigate } from '../../lib/router';
import { Bar, Mascot, Stars } from '../components';

export function Home() {
  const progress = useProgress();
  const name = useSettings((s) => s.userName);
  const next = nextLesson(progress);
  const exam = pendingExam(progress);
  const cp = courseProgress(progress);
  const refs = allLessons();
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="page">
      <div className="card glow" style={{ display: 'flex', gap: 24, alignItems: 'center', padding: 26 }}>
        <Mascot size={120} mood="cool" float />
        <div className="grow">
          <div className="muted">{greet}{name ? `, ${name}` : ''}!</div>
          <h1 style={{ marginTop: 4 }}>
            {exam !== null ? (
              <>Пора на экзамен: «{COURSE[exam].title}»</>
            ) : next ? (
              <>
                Урок {next.moduleIndex + 1}.{next.lessonIndex + 1}: {next.lesson.title}
              </>
            ) : (
              <>Курс пройден! Вы — настоящий саксофонист 🎷</>
            )}
          </h1>
          <div className="row" style={{ gap: 14, marginTop: 6 }}>
            <div style={{ width: 260 }}>
              <Bar value={cp.percent} />
            </div>
            <span className="small muted">
              Пройдено {cp.done} из {cp.total} уроков
            </span>
          </div>
          <div className="row mt">
            {exam !== null ? (
              <button className="btn big" onClick={() => navigate(`/exam/${COURSE[exam].id}`)}>
                <Trophy size={20} /> К экзамену
              </button>
            ) : next ? (
              <button className="btn big" onClick={() => navigate(`/lesson/${next.lesson.id}`)}>
                <Play size={20} /> Продолжить
              </button>
            ) : null}
            <button className="btn ghost big" onClick={() => navigate('/warmup')}>
              <Zap size={20} /> Разминка дня
            </button>
          </div>
        </div>
      </div>

      <div className="mt-l">
        {COURSE.map((m, mi) => {
          const st = examStatus(mi, progress);
          const locked = st === 'locked';
          const lessonsDone = m.lessons.filter((l) => lessonStatus(refs.find((r) => r.lesson.id === l.id)!, progress) === 'completed').length;
          return (
            <div key={m.id} className={`module ${locked ? 'locked' : ''}`}>
              <div className="module-head">
                <div className="module-icon">{m.icon}</div>
                <div className="grow">
                  <div className="tiny muted display">МОДУЛЬ {mi + 1}</div>
                  <h2 style={{ margin: 0 }}>{m.title}</h2>
                  <div className="small muted">{m.description}</div>
                </div>
                <div className="center" style={{ minWidth: 120 }}>
                  <div className="small muted">
                    {lessonsDone}/{m.lessons.length} уроков
                  </div>
                  <Bar value={(100 * lessonsDone) / m.lessons.length} thin />
                </div>
              </div>
              <div className="path">
                {m.lessons.map((l, li) => {
                  const ref = refs.find((r) => r.lesson.id === l.id)!;
                  const s = lessonStatus(ref, progress);
                  const isCurrent = next?.lesson.id === l.id;
                  const stars = l.exercises.length
                    ? Math.round(l.exercises.reduce((a, e) => a + (progress.exercises[exKey(l.id, e.id)]?.stars ?? 0), 0) / l.exercises.length)
                    : 0;
                  return (
                    <div
                      key={l.id}
                      className={`node ${s === 'completed' ? 'done' : ''} ${s === 'locked' ? 'locked' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => s !== 'locked' && navigate(`/lesson/${l.id}`)}
                      title={s === 'locked' ? 'Сначала пройдите предыдущий урок' : l.subtitle}
                    >
                      <div className="row between">
                        <span className="num">
                          {mi + 1}.{li + 1}
                        </span>
                        {s === 'locked' ? <Lock size={16} /> : s === 'completed' ? <CheckCircle2 size={18} color="var(--good)" /> : null}
                      </div>
                      <div className="ttl">{l.title}</div>
                      {l.subtitle && <div className="tiny muted">{l.subtitle}</div>}
                      <div className="stars">
                        <Stars n={stars} size={15} />
                      </div>
                    </div>
                  );
                })}
                <div
                  className={`node exam ${st === 'completed' ? 'done' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => !locked && navigate(`/exam/${m.id}`)}
                  title={locked ? 'Модуль ещё закрыт' : 'Экзамен можно сдать досрочно, чтобы пропустить знакомые уроки'}
                >
                  <div className="row between">
                    <span className="num">ЭКЗАМЕН</span>
                    {st === 'completed' ? <CheckCircle2 size={18} color="var(--good)" /> : locked ? <Lock size={16} /> : <Trophy size={18} color="var(--accent-3)" />}
                  </div>
                  <div className="ttl">{m.exam.title}</div>
                  <div className="tiny muted">{st === 'completed' ? `Сдан: ${progress.exams[m.id]?.best}%` : 'Открывает следующий модуль'}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
