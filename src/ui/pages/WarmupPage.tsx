// «Разминка дня»: a short routine generated from what the learner already knows.
import { useMemo, useState } from 'react';
import { ArrowLeft, Zap, CheckCircle2 } from 'lucide-react';
import { useProgress } from '../../store/progress';
import { navigate } from '../../lib/router';
import { celebrate, burst, playSfx } from '../../lib/toast';
import { breath, longtone, seq, scaleAbc, abc } from '../../content/helpers';
import { COURSE } from '../../content/course';
import type { Exercise } from '../../practice/types';
import { ExerciseRunner } from '../practice/Runner';
import { Mascot } from '../components';
import { todayKey } from '../../store/db';

function seededPick<T>(arr: T[], seed: string, k: number): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return arr[Math.abs(h + k * 7919) % arr.length];
}

export function buildWarmup(p: ReturnType<typeof useProgress.getState>): Exercise[] {
  const passedModules = COURSE.filter((m) => p.exams[m.id]?.passed).length;
  const day = todayKey();
  const pools = [
    [71, 69, 67],
    [67, 65, 64, 62],
    [72, 71, 69, 67, 65],
    [74, 76, 77, 79],
    [79, 81, 83, 84],
  ];
  const level = Math.min(pools.length - 1, passedModules);
  const toneNotes = [...new Set([...pools[Math.max(0, level - 1)], ...pools[level]])];
  const three = [0, 1, 2].map((k) => seededPick(toneNotes, day, k));
  const out: Exercise[] = [
    breath('w-breath', 'Дыхание', Math.min(20, 8 + passedModules * 2), { goal: 'Разогрейте дыхание: вдох животом и ровный выдох на «ссс».' }),
    longtone('w-long', 'Долгие ноты', [...new Set(three)], Math.min(10, 5 + passedModules), { goal: 'Ровный, тёплый звук на каждой ноте.' }),
  ];
  if (passedModules >= 2) {
    const scales: [number, string][] = [
      [60, 'C'],
      [67, 'G'],
      [65, 'F'],
    ];
    const [root, key] = seededPick(scales, day, 3);
    out.push(seq('w-scale', 'Гамма дня', scaleAbc(root, 'major', { key, bpm: 72 + passedModules * 4 }), { goal: 'Гамма вверх и вниз ровными четвертями.', modes: ['tempo', 'wait'] }));
  } else {
    out.push(seq('w-tongue', 'Атака языком', abc('B B A A | G G A A | B A G2 |]', { bpm: 72 }), { goal: 'Чёткая атака «ту» на каждую ноту.' }));
  }
  return out;
}

export function WarmupPage() {
  const state = useProgress();
  const recordWarmup = useProgress((s) => s.recordWarmup);
  const plan = useMemo(() => buildWarmup(useProgress.getState()), []);
  const [idx, setIdx] = useState(-1);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  const complete = () => {
    const o = recordWarmup();
    celebrate(o);
    burst(true);
    playSfx('success');
    setFinished(true);
    setIdx(-1);
  };

  if (idx >= 0) {
    const ex = plan[idx];
    return (
      <div className="page page-wide">
        <button className="btn ghost mb" onClick={() => setIdx(-1)}>
          <ArrowLeft size={18} /> Разминка
        </button>
        <ExerciseRunner
          key={ex.id}
          ex={ex}
          ctx={{ exerciseKey: `warmup/${ex.id}`, lessonId: 'warmup', lessonTitle: 'Разминка дня', tier: 1 }}
          onDone={() => setDone((d) => new Set(d).add(ex.id))}
          onNext={() => {
            if (idx + 1 < plan.length) setIdx(idx + 1);
            else complete();
          }}
          nextLabel={idx + 1 < plan.length ? 'Дальше' : 'Завершить разминку'}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <button className="btn ghost" onClick={() => navigate('/')}>
        <ArrowLeft size={18} /> На главную
      </button>
      <div className="card glow mt row" style={{ gap: 20 }}>
        <Mascot size={110} mood={finished ? 'wow' : 'cool'} float />
        <div>
          <h1>
            <Zap color="var(--accent-3)" /> Разминка дня
          </h1>
          <p className="muted">
            5–7 минут, чтобы «разбудить» дыхание, губы и пальцы. Упражнения меняются каждый день и подстраиваются под ваш уровень. Разминок всего:{' '}
            {state.totals.warmups}.
          </p>
          {finished ? (
            <div className="chip good">Разминка выполнена! +30 XP</div>
          ) : (
            <button className="btn big" onClick={() => setIdx(0)}>
              Начать разминку
            </button>
          )}
        </div>
      </div>
      <div className="col mt" style={{ gap: 10 }}>
        {plan.map((e, i) => (
          <div key={e.id} className="card row between hover" onClick={() => setIdx(i)}>
            <div>
              <div className="tiny muted">Шаг {i + 1}</div>
              <b>{e.title}</b>
              <div className="small muted">{e.goal}</div>
            </div>
            {done.has(e.id) && <CheckCircle2 color="var(--good)" />}
          </div>
        ))}
      </div>
    </div>
  );
}
