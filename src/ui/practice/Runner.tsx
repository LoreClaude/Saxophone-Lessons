// Picks the right runner for an exercise and shows results afterwards.
import { useState } from 'react';
import type { Exercise } from '../../practice/types';
import { TIER_NAMES } from '../../practice/types';
import { Markdown } from '../components';
import { SequenceRunner } from './SequenceRunner';
import { NotesRunner } from './NotesRunner';
import { HoldRunner } from './HoldRunner';
import { EchoRunner } from './EchoRunner';
import { ImprovRunner } from './ImprovRunner';
import { ResultView } from './ResultView';
import type { FinishedAttempt, RunContext } from './common';

export function ExerciseRunner({
  ex,
  ctx,
  onNext,
  nextLabel,
  onDone,
  hideHeader,
}: {
  ex: Exercise;
  ctx: RunContext;
  onNext?: () => void;
  nextLabel?: string;
  onDone?: (a: FinishedAttempt) => void;
  hideHeader?: boolean;
}) {
  const [attempt, setAttempt] = useState<FinishedAttempt | null>(null);
  const [runKey, setRunKey] = useState(0);
  const finish = (a: FinishedAttempt) => {
    setAttempt(a);
    onDone?.(a);
  };
  const retry = () => {
    setAttempt(null);
    setRunKey((k) => k + 1);
  };
  return (
    <div className="col" style={{ gap: 16 }}>
      {!hideHeader && (
        <div className="card" style={{ padding: 16 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>{ex.title}</h2>
            <span className="chip">Строгость: {TIER_NAMES[ctx.tier]}</span>
          </div>
          <Markdown md={ex.goal} className="mt" />
          {ex.tips?.length ? (
            <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {ex.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {attempt ? (
        <ResultView ex={ex} attempt={attempt} lessonTitle={ctx.lessonTitle} tier={ctx.tier} onRetry={retry} onNext={onNext} nextLabel={nextLabel} />
      ) : (
        <RunnerFor key={runKey} ex={ex} ctx={ctx} onFinish={finish} />
      )}
    </div>
  );
}

function RunnerFor({ ex, ctx, onFinish }: { ex: Exercise; ctx: RunContext; onFinish: (a: FinishedAttempt) => void }) {
  switch (ex.kind) {
    case 'sequence':
      return <SequenceRunner ex={ex} ctx={ctx} onFinish={onFinish} />;
    case 'notes':
      return <NotesRunner ex={ex} ctx={ctx} onFinish={onFinish} />;
    case 'echo':
      return <EchoRunner ex={ex} ctx={ctx} onFinish={onFinish} />;
    case 'improv':
      return <ImprovRunner ex={ex} ctx={ctx} onFinish={onFinish} />;
    default:
      return <HoldRunner ex={ex} ctx={ctx} onFinish={onFinish} />;
  }
}
