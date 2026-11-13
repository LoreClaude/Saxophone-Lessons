import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, CheckCircle2, Lock } from 'lucide-react';
import { findModule, examStatus, examKey } from '../../content/progression';
import { useProgress } from '../../store/progress';
import { navigate } from '../../lib/router';
import { celebrate, burst, playSfx } from '../../lib/toast';
import { ExerciseRunner } from '../practice/Runner';
import { Quiz } from '../quiz/Quiz';
import { Mascot, Stars } from '../components';
import { COURSE } from '../../content/course';

const EXAM_QUIZ_KEY = (m: string) => `exam:${m}`;

export function ExamPage({ moduleId }: { moduleId: string }) {
  const found = findModule(moduleId);
  const progress = useProgress();
  const recordExam = useProgress((s) => s.recordExam);
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const unlock = useProgress((s) => s.unlock);
  const [active, setActive] = useState<string | null>(null);
  const [quiz, setQuiz] = useState(false);

  const m = found?.module;
  const idx = found?.index ?? 0;
  const exPassed = (id: string) => Boolean(m && progress.exercises[examKey(m.id, id)]?.passed);
  const quizOk = !m?.exam.quiz?.length || (progress.lessons[EXAM_QUIZ_KEY(moduleId)]?.quizBest ?? 0) >= 80;
  const allOk = Boolean(m && m.exam.exercises.every((e) => exPassed(e.id)) && quizOk);

  useEffect(() => {
    if (!m || !allOk || progress.exams[m.id]?.passed) return;
    const scores = m.exam.exercises.map((e) => progress.exercises[examKey(m.id, e.id)]?.best ?? 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const o = recordExam(m.id, avg, true);
    celebrate(o);
    burst(true);
    playSfx('levelup');
    if (idx === COURSE.length - 1) unlock('course_done');
  }, [allOk, m, progress, recordExam, idx, unlock]);

  if (!m) return <div className="page">Модуль не найден.</div>;
  const st = examStatus(idx, progress);
  if (st === 'locked')
    return (
      <div className="page center col" style={{ alignItems: 'center', paddingTop: 60 }}>
        <Lock size={48} />
        <h2>Экзамен пока закрыт</h2>
        <button className="btn" onClick={() => navigate('/')}>
          К карте
        </button>
      </div>
    );

  const activeEx = m.exam.exercises.find((e) => e.id === active);
  if (activeEx) {
    const i = m.exam.exercises.indexOf(activeEx);
    const next = m.exam.exercises[i + 1];
    return (
      <div className="page page-wide">
        <button className="btn ghost mb" onClick={() => setActive(null)}>
          <ArrowLeft size={18} /> Экзамен
        </button>
        <ExerciseRunner
          key={activeEx.id}
          ex={activeEx}
          ctx={{ exerciseKey: examKey(m.id, activeEx.id), lessonId: `exam:${m.id}`, lessonTitle: m.exam.title, tier: activeEx.tier ?? (Math.min(4, 1 + Math.floor(idx / 3)) as 1 | 2 | 3 | 4), xpBase: 40 }}
          onNext={() => setActive(next ? next.id : null)}
          nextLabel={next ? 'Следующее задание' : 'К экзамену'}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn ghost" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Карта курса
      </button>
      <div className="card glow mt row" style={{ gap: 22 }}>
        <Mascot size={110} mood={st === 'completed' ? 'wow' : 'cool'} />
        <div className="grow">
          <div className="tiny muted display">
            МОДУЛЬ {idx + 1} · ЭКЗАМЕН
          </div>
          <h1>
            <Trophy color="var(--accent-3)" /> {m.exam.title}
          </h1>
          <p className="muted">{m.exam.description}</p>
          {st === 'completed' ? (
            <div className="chip good">Экзамен сдан — следующий модуль открыт!</div>
          ) : (
            <div className="small muted">
              Сдайте все задания и тест. Экзамен можно сдать сразу, не проходя уроки модуля, — тогда они засчитаются автоматически.
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-2 mt">
        {m.exam.exercises.map((e, i) => {
          const ep = progress.exercises[examKey(m.id, e.id)];
          return (
            <div key={e.id} className="card hover" onClick={() => setActive(e.id)}>
              <div className="row between">
                <span className="tiny muted">Задание {i + 1}</span>
                {ep?.passed && <CheckCircle2 size={18} color="var(--good)" />}
              </div>
              <h3 style={{ margin: '4px 0' }}>{e.title}</h3>
              <div className="small muted">{e.goal}</div>
              <div className="row between mt">
                <Stars n={ep?.stars ?? 0} />
                <span className="small">{ep ? `лучшее: ${ep.best}%` : 'не начато'}</span>
              </div>
            </div>
          );
        })}
      </div>
      {m.exam.quiz?.length ? (
        <div className="mt-l">
          {quiz ? (
            <Quiz spec={m.exam.quiz} title="Теория" onFinish={(c, t) => celebrate(recordQuiz(EXAM_QUIZ_KEY(m.id), c, t))} />
          ) : (
            <div className="card row between">
              <div>
                <h3 style={{ margin: 0 }}>Тест по теории</h3>
                <div className="small muted">Лучший результат: {progress.lessons[EXAM_QUIZ_KEY(m.id)]?.quizBest ?? 0}% (нужно 80%)</div>
              </div>
              <button className="btn" onClick={() => setQuiz(true)}>
                Начать
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
