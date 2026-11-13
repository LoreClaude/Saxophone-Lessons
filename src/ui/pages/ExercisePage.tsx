import { ArrowLeft } from 'lucide-react';
import { findLesson, exKey, lessonStatus } from '../../content/progression';
import { useProgress } from '../../store/progress';
import { navigate } from '../../lib/router';
import { ExerciseRunner } from '../practice/Runner';

export function ExercisePage({ lessonId, exerciseId }: { lessonId: string; exerciseId: string }) {
  const ref = findLesson(lessonId);
  const progress = useProgress();
  if (!ref) return <div className="page">Урок не найден.</div>;
  const ex = ref.lesson.exercises.find((e) => e.id === exerciseId);
  if (!ex) return <div className="page">Упражнение не найдено.</div>;
  if (lessonStatus(ref, progress) === 'locked') {
    navigate(`/lesson/${lessonId}`);
    return null;
  }
  const idx = ref.lesson.exercises.indexOf(ex);
  const next = ref.lesson.exercises[idx + 1];
  return (
    <div className="page page-wide">
      <div className="row between mb">
        <button className="btn ghost" onClick={() => navigate(`/lesson/${lessonId}`)}>
          <ArrowLeft size={18} /> {ref.lesson.title}
        </button>
        <span className="small muted">
          Упражнение {idx + 1} из {ref.lesson.exercises.length}
        </span>
      </div>
      <ExerciseRunner
        key={ex.id}
        ex={ex}
        ctx={{ exerciseKey: exKey(lessonId, ex.id), lessonId, lessonTitle: ref.lesson.title, tier: ex.tier ?? ref.lesson.tier }}
        onNext={() => (next ? navigate(`/exercise/${lessonId}/${next.id}`) : navigate(`/lesson/${lessonId}`))}
        nextLabel={next ? 'Следующее упражнение' : 'К уроку'}
      />
    </div>
  );
}
