// Theory and ear-training quizzes.
import { useMemo, useState } from 'react';
import { Volume2, ArrowRight, RotateCcw } from 'lucide-react';
import type { QuizQuestion, Demo } from '../../content/types';
import { buildAbc } from '../../music/abc';
import { noteNameRu, INTERVAL_NAMES_RU } from '../../music/notes';
import { mainFingering } from '../../music/fingering';
import { playDemo } from '../../lib/demo';
import { playSfx, burst } from '../../lib/toast';
import { Staff } from '../notation/Staff';
import { FingeringDiagram } from '../notation/Fingering';
import { Bar, Markdown, Mascot } from '../components';

interface Concrete {
  prompt: string;
  options: string[];
  answer: number;
  explain?: string;
  abc?: string;
  fingering?: number;
  listen?: Demo;
}

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function optionsWith(correct: string, pool: string[], k = 4) {
  const others = shuffle([...new Set(pool.filter((x) => x !== correct))]).slice(0, k - 1);
  const opts = shuffle([correct, ...others]);
  return { options: opts, answer: opts.indexOf(correct) };
}

const ALL_NAMES = ['До', 'Ре', 'Ми', 'Фа', 'Соль', 'Ля', 'Си', 'До♯', 'Ми♭', 'Фа♯', 'Соль♯', 'Си♭'];

const CHORDS: Record<string, { ints: number[]; name: string }> = {
  major: { ints: [0, 4, 7], name: 'Мажорное трезвучие' },
  minor: { ints: [0, 3, 7], name: 'Минорное трезвучие' },
  dom7: { ints: [0, 4, 7, 10], name: 'Доминантсептаккорд' },
  dim: { ints: [0, 3, 6], name: 'Уменьшённое трезвучие' },
};

export function generateQuiz(spec: QuizQuestion[]): Concrete[] {
  const out: Concrete[] = [];
  for (const q of spec) {
    switch (q.type) {
      case 'mcq':
        out.push({ prompt: q.q, options: q.options, answer: q.answer, explain: q.explain, abc: q.abc, listen: q.listen });
        break;
      case 'noteName':
        for (let i = 0; i < q.count; i++) {
          const m = pick(q.notes);
          const name = noteNameRu(m);
          const pool = [...new Set([...q.notes.map((x) => noteNameRu(x)), ...ALL_NAMES.slice(0, 7)])];
          out.push({
            prompt: 'Какая нота написана?',
            abc: buildAbc([{ midi: m, beats: 4 }], { key: 'C', meter: [4, 4] }).replace('M:4/4', 'M:none'),
            ...optionsWith(name, pool),
          });
        }
        break;
      case 'fingeringName':
        for (let i = 0; i < q.count; i++) {
          const m = q.notes[i % q.notes.length];
          const pool = [...new Set([...q.notes.map((x) => noteNameRu(x)), ...ALL_NAMES])];
          out.push({ prompt: 'Какой ноте соответствует эта аппликатура?', fingering: m, ...optionsWith(noteNameRu(m), pool) });
        }
        break;
      case 'interval':
        for (let i = 0; i < q.count; i++) {
          const iv = pick(q.intervals);
          const base = 62 + Math.floor(Math.random() * 8);
          const names = q.intervals.map((x) => INTERVAL_NAMES_RU[x]);
          out.push({
            prompt: 'Послушайте два звука. Какой это интервал?',
            listen: { kind: 'interval', a: base, b: base + iv },
            ...optionsWith(INTERVAL_NAMES_RU[iv], names.length >= 2 ? names : Object.values(INTERVAL_NAMES_RU)),
          });
        }
        break;
      case 'chordQuality':
        for (let i = 0; i < q.count; i++) {
          const kind = pick(q.qualities);
          const root = 60 + Math.floor(Math.random() * 7);
          out.push({
            prompt: 'Послушайте аккорд. Какой он?',
            listen: { kind: 'chord', notes: CHORDS[kind].ints.map((x) => root + x) },
            ...optionsWith(
              CHORDS[kind].name,
              q.qualities.map((k) => CHORDS[k].name),
              Math.min(4, q.qualities.length),
            ),
          });
        }
        break;
    }
  }
  return out;
}

export function Quiz({ spec, onFinish, title = 'Тест' }: { spec: QuizQuestion[]; onFinish: (correct: number, total: number) => void; title?: string }) {
  const [seed, setSeed] = useState(0);
  const questions = useMemo(() => generateQuiz(spec), [spec, seed]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const q = questions[idx];

  const choose = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    if (i === q.answer) {
      setCorrect((c) => c + 1);
      playSfx('hit');
    } else playSfx('miss');
  };
  const next = () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      const total = questions.length;
      const right = correct;
      if (right === total) burst();
      onFinish(right, total);
    } else {
      setIdx(idx + 1);
      setChosen(null);
    }
  };
  const restart = () => {
    setSeed((s) => s + 1);
    setIdx(0);
    setChosen(null);
    setCorrect(0);
    setDone(false);
  };

  if (done) {
    const pct = Math.round((100 * correct) / questions.length);
    return (
      <div className="card col center" style={{ alignItems: 'center' }}>
        <Mascot size={100} mood={pct >= 80 ? 'wow' : 'think'} />
        <h2>
          {title}: {correct} из {questions.length}
        </h2>
        <p className="muted">{pct >= 80 ? 'Тест пройден!' : 'Для зачёта нужно 80% правильных ответов. Попробуйте ещё раз.'}</p>
        <button className="btn" onClick={restart}>
          <RotateCcw size={18} /> Пройти заново
        </button>
      </div>
    );
  }
  if (!q) return null;
  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className="muted small">
          Вопрос {idx + 1} из {questions.length}
        </span>
      </div>
      <div className="mt" style={{ marginTop: 8 }}>
        <Bar value={(100 * idx) / questions.length} thin />
      </div>
      <div className="mt">
        <Markdown md={q.prompt} />
        {q.abc && (
          <div style={{ maxWidth: 360 }}>
            <Staff abc={q.abc} scale={1.6} />
          </div>
        )}
        {q.fingering !== undefined && (
          <div className="center">
            <FingeringDiagram fingering={mainFingering(q.fingering)} size={1} />
          </div>
        )}
        {q.listen && (
          <button className="btn ghost" onClick={() => playDemo(q.listen!)}>
            <Volume2 size={18} /> Послушать
          </button>
        )}
      </div>
      <div className="quiz-options mt">
        {q.options.map((o, i) => (
          <div
            key={i}
            className={`quiz-opt ${chosen !== null && i === q.answer ? 'right' : ''} ${chosen === i && i !== q.answer ? 'wrong' : ''}`}
            onClick={() => choose(i)}
          >
            {o}
          </div>
        ))}
      </div>
      {chosen !== null && (
        <div className="row between mt">
          <div className="small">{chosen === q.answer ? '✅ Верно!' : `❌ Правильный ответ: ${q.options[q.answer]}`}{q.explain ? ` — ${q.explain}` : ''}</div>
          <button className="btn" onClick={next}>
            Дальше <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
