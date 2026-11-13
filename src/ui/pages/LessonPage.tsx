import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Play, Volume2, Video, Lightbulb, AlertTriangle, Clock } from 'lucide-react';
import { findLesson, lessonRequirementsMet, lessonStatus, exKey, allLessons } from '../../content/progression';
import type { TheoryBlock } from '../../content/types';
import { useProgress } from '../../store/progress';
import { useSettings } from '../../store/settings';
import { navigate } from '../../lib/router';
import { playDemo, stopDemo } from '../../lib/demo';
import { celebrate, burst, playSfx } from '../../lib/toast';
import { platform } from '../../lib/platform';
import { mainFingering, fingeringsFor } from '../../music/fingering';
import { fullNoteNameRu } from '../../music/notes';
import { KIND_NAMES } from '../../practice/types';
import { Markdown, Stars, Mascot } from '../components';
import { Illustration } from '../illustrations';
import { Staff } from '../notation/Staff';
import { FingeringDiagram, FingeringLegend } from '../notation/Fingering';
import { Quiz } from '../quiz/Quiz';

export function LessonPage({ id }: { id: string }) {
  const ref = findLesson(id);
  const progress = useProgress();
  const recordQuiz = useProgress((s) => s.recordQuiz);
  const completeLesson = useProgress((s) => s.completeLesson);
  const [quizOpen, setQuizOpen] = useState(false);
  const quizRef = useRef<HTMLDivElement>(null);
  const openQuiz = () => {
    setQuizOpen(true);
    setTimeout(() => quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  useEffect(() => () => stopDemo(), []);
  useEffect(() => {
    if (ref && !progress.lessons[ref.lesson.id]?.completed && lessonRequirementsMet(ref.lesson, progress)) {
      const o = completeLesson(ref.lesson.id);
      if (o) {
        celebrate(o);
        burst(true);
        playSfx('success');
      }
    }
  }, [ref, progress, completeLesson]);

  if (!ref) return <div className="page">Урок не найден.</div>;
  const { lesson, module, moduleIndex, lessonIndex } = ref;
  const status = lessonStatus(ref, progress);
  if (status === 'locked')
    return (
      <div className="page center col" style={{ alignItems: 'center', paddingTop: 60 }}>
        <Lock size={48} />
        <h2>Урок пока закрыт</h2>
        <p className="muted">Пройдите предыдущие уроки или сдайте экзамен модуля.</p>
        <button className="btn" onClick={() => navigate('/')}>
          К карте курса
        </button>
      </div>
    );

  const lp = progress.lessons[lesson.id];
  const refs = allLessons();
  const idx = refs.findIndex((r) => r.lesson.id === lesson.id);
  const nextRef = refs[idx + 1];
  const requiredDone = lesson.exercises.filter((e) => !e.optional && progress.exercises[exKey(lesson.id, e.id)]?.passed).length;
  const required = lesson.exercises.filter((e) => !e.optional).length;

  return (
    <div className="page">
      <button className="btn ghost" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> Карта курса
      </button>
      <div className="row mt" style={{ alignItems: 'flex-end', gap: 18 }}>
        <div className="grow">
          <div className="tiny muted display">
            МОДУЛЬ {moduleIndex + 1} · {module.title.toUpperCase()} · УРОК {moduleIndex + 1}.{lessonIndex + 1}
          </div>
          <h1 style={{ margin: '6px 0 4px' }}>{lesson.title}</h1>
          <div className="row muted small">
            {lesson.subtitle && <span>{lesson.subtitle}</span>}
            {lesson.minutes && (
              <span className="row" style={{ gap: 4 }}>
                <Clock size={14} /> ~{lesson.minutes} мин
              </span>
            )}
            {lp?.completed && <span className="chip good">Пройден</span>}
          </div>
        </div>
      </div>

      <div className="grid mt-l" style={{ gridTemplateColumns: 'minmax(0,1fr) 330px', alignItems: 'start' }}>
        <div className="col" style={{ gap: 18 }}>
          {lesson.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
          {lesson.quiz?.length ? (
            <div className="mt" ref={quizRef}>
              {quizOpen ? (
                <Quiz
                  spec={lesson.quiz}
                  title="Проверь себя"
                  onFinish={(c, t) => {
                    celebrate(recordQuiz(lesson.id, c, t));
                  }}
                />
              ) : (
                <div className="card row between">
                  <div>
                    <h3 style={{ margin: 0 }}>Проверь себя</h3>
                    <div className="small muted">
                      {lesson.quiz.length > 1 ? 'Небольшой тест по уроку.' : 'Один вопрос по уроку.'} Лучший результат: {lp?.quizBest ?? 0}%
                    </div>
                  </div>
                  <button className="btn" onClick={openQuiz}>
                    Начать тест
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="col" style={{ position: 'sticky', top: 0, gap: 14 }}>
          <div className="card">
            <h3>Практика</h3>
            <div className="small muted mb">
              Выполнено {requiredDone} из {required}. Для перехода дальше сдайте все упражнения{lesson.quiz?.length ? ' и тест' : ''}.
            </div>
            <div className="col" style={{ gap: 10 }}>
              {lesson.exercises.map((e, i) => {
                const ep = progress.exercises[exKey(lesson.id, e.id)];
                return (
                  <div key={e.id} className="card hover" style={{ padding: 12 }} onClick={() => navigate(`/exercise/${lesson.id}/${e.id}`)}>
                    <div className="row between">
                      <span className="tiny muted">
                        {i + 1}. {KIND_NAMES[e.kind]}
                        {e.optional ? ' · по желанию' : ''}
                      </span>
                      {ep?.passed ? <CheckCircle2 size={16} color="var(--good)" /> : null}
                    </div>
                    <div style={{ fontWeight: 700 }}>{e.title}</div>
                    <div className="row between">
                      <Stars n={ep?.stars ?? 0} size={14} />
                      <span className="small muted">{ep ? `лучшее: ${ep.best}%` : 'не начато'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {lesson.quiz?.length ? (
              <div className="card hover mt" style={{ padding: 12 }} onClick={openQuiz}>
                <div className="row between">
                  <span className="tiny muted">Тест по уроку · нужно 80%</span>
                  {(lp?.quizBest ?? 0) >= 80 ? <CheckCircle2 size={16} color="var(--good)" /> : null}
                </div>
                <div className="row between">
                  <b>Проверь себя</b>
                  <span className={(lp?.quizBest ?? 0) >= 80 ? 'chip good' : 'chip'}>{lp?.quizBest ?? 0}%</span>
                </div>
                <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={(e) => (e.stopPropagation(), openQuiz())}>
                  Пройти тест
                </button>
              </div>
            ) : null}
          </div>
          {lp?.completed && nextRef && (
            <button className="btn big" onClick={() => navigate(`/lesson/${nextRef.lesson.id}`)}>
              Следующий урок <ArrowRight size={18} />
            </button>
          )}
          {lp?.completed && !nextRef && (
            <div className="card center">
              <Mascot size={80} mood="wow" />
              <div>Последний урок курса пройден!</div>
            </div>
          )}
          {lp?.completed && nextRef && nextRef.module.id !== module.id && (
            <button className="btn ghost" onClick={() => navigate(`/exam/${module.id}`)}>
              Экзамен модуля
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Block({ block }: { block: TheoryBlock }) {
  const showNames = useSettings((s) => s.showNoteNames);
  switch (block.type) {
    case 'text':
      return <Markdown md={block.md} />;
    case 'tip':
      return (
        <div className="card" style={{ borderColor: 'var(--accent-2)', display: 'flex', gap: 14 }}>
          <Lightbulb color="var(--accent-2)" style={{ flex: 'none' }} />
          <div>
            {block.title && <b>{block.title}</b>}
            <Markdown md={block.md} />
          </div>
        </div>
      );
    case 'warn':
      return (
        <div className="card" style={{ borderColor: 'var(--ok)', display: 'flex', gap: 14 }}>
          <AlertTriangle color="var(--ok)" style={{ flex: 'none' }} />
          <Markdown md={block.md} />
        </div>
      );
    case 'illustration':
      return <Illustration id={block.id} caption={block.caption} />;
    case 'abc':
      return (
        <div className="card">
          <Staff abc={block.abc} showNames={block.names ?? showNames} showFingerings={block.fingerings} />
          <div className="row between">
            <span className="small muted">{block.caption}</span>
            <button className="btn ghost" onClick={() => playDemo({ kind: 'abc', abc: block.abc, bpm: block.bpm })}>
              <Play size={16} /> Послушать
            </button>
          </div>
        </div>
      );
    case 'fingering':
      return (
        <div className="card">
          <div className="row wrap" style={{ justifyContent: 'space-around', alignItems: 'flex-start' }}>
            {block.notes.map((m) => (
              <div key={m} className="col center" style={{ alignItems: 'center', gap: 4 }}>
                <b className="display" style={{ fontSize: 20 }}>
                  {fullNoteNameRu(m)}
                </b>
                <FingeringDiagram fingering={mainFingering(m)} size={0.9} />
                <FingeringLegend fingering={mainFingering(m)} />
                {fingeringsFor(m).length > 1 && <div className="tiny" style={{ color: 'var(--accent-3)' }}>+ {fingeringsFor(m).length - 1} альтернативные</div>}
                <button className="btn ghost" onClick={() => playDemo({ kind: 'note', note: m })}>
                  <Volume2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {block.caption && <div className="small muted center mt">{block.caption}</div>}
        </div>
      );
    case 'listen':
      return (
        <div className="card row between">
          <div>
            <b>{block.label}</b>
            {block.caption && <div className="small muted">{block.caption}</div>}
          </div>
          <button className="btn" onClick={() => playDemo(block.demo)}>
            <Volume2 size={18} /> Слушать
          </button>
        </div>
      );
    case 'compare':
      return (
        <div className="card">
          {block.caption && <div className="mb">{block.caption}</div>}
          <div className="row wrap">
            {block.items.map((it, i) => (
              <button key={i} className="btn ghost" onClick={() => playDemo(it.demo)}>
                <Volume2 size={16} /> {it.label}
              </button>
            ))}
          </div>
        </div>
      );
    case 'video':
      return (
        <div className="card row between">
          <div className="row">
            <Video color="#ff3b3b" />
            <div>
              <b>Видео: {block.title}</b>
              <div className="small muted">Откроется поиск на YouTube в браузере</div>
            </div>
          </div>
          <button className="btn ghost" onClick={() => platform.openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(block.query)}`)}>
            Найти видео
          </button>
        </div>
      );
  }
}
